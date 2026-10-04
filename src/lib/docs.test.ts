import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORIES, TAGS } from "./schema";
import { SEED_IDEAS } from "./corpus/seeds";
import { DEEPENED_LIMIT } from "./corpus/deepened";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The docs in this repo state facts about the code: how many seeds there are,
 * what an environment variable is allowed to be, where the corpus stops growing.
 * Nothing measured any of them, so all of it drifted at once — a documented
 * MURMUR_DEEPEN_COUNT of 6 against a script default of 12, four variables
 * offered as knobs that nothing read, a README claiming 58 cards and 111 tests.
 *
 * These four checks are the join. Each takes text rather than paths so its own
 * negative control can feed it a corrupted document without touching the tree.
 */

/** Every source file a fact could hide in: code, shell, and the units. */
function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string, keep: (name: string) => boolean) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry === ".data") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path, keep);
      else if (keep(entry)) found.push(path);
    }
  };
  walk(join(ROOT, "src"), (n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
  walk(join(ROOT, "scripts"), (n) => n.endsWith(".ts") || n.endsWith(".sh"));
  found.push(join(ROOT, "systemd", "murmur-model.service"));
  found.push(join(ROOT, "systemd", "murmur-deepen.service"));
  return found;
}

const read = (path: string) => readFileSync(path, "utf8");

/** The name of every variable the document assigns a value to. */
export function documentedVars(doc: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of doc.split("\n")) {
    const match = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      out.set(match[1], match[2].trim());
    }
  }
  return out;
}

/**
 * Numeric literals are written with separators in code and without in documents:
 * 90_000 in TypeScript, 90000 in .env.example. Only between digits — applying it
 * to the whole value turned the GGUF path's iq2_m into iq2m and reported the
 * document and the unit as disagreeing when they were byte-identical.
 */
const plain = (value: string) => value.replaceAll(/(\d)_(?=\d)/g, "$1");

/**
 * Every default a variable falls back to, wherever one is declared: `?? lit` and
 * `numberOr(process.env.X, n)` in TypeScript, `${X:-lit}` in shell, and
 * `Environment=X=v` in a unit. More than one source is normal — the server unit
 * and the deepen script each have their own — and they all have to agree, because
 * the server binds one port while the deepener health-checks another.
 *
 * Takes path→text and returns name→defaults, so the name is read out of the text
 * rather than trusted from the key. It used to trust the key, which was a file
 * path, so it found nothing and every value check passed for free.
 */
export function declaredDefaults(sources: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const push = (name: string | undefined, raw: string | undefined) => {
    if (!name || raw === undefined) return;
    const value = plain(raw.replace(/^["']|["']$/g, ""));
    const list = out.get(name) ?? [];
    if (!list.includes(value)) list.push(value);
    out.set(name, list);
  };

  for (const text of sources.values()) {
    const fallback = /\bprocess\.env\.([A-Z][A-Z0-9_]*)\s*\?\?\s*("[^"]*"|'[^']*'|\d[\d_]*)/g;
    for (const [, name, raw] of text.matchAll(fallback)) push(name, raw);
    const viaHelper = /\bnumberOr\(\s*process\.env\.([A-Z][A-Z0-9_]*)\s*,\s*(\d[\d_]*)/g;
    for (const [, name, raw] of text.matchAll(viaHelper)) push(name, raw);
    const shell = /\$\{([A-Z][A-Z0-9_]*):-([^}]*)\}/g;
    for (const [, name, raw] of text.matchAll(shell)) push(name, raw);
    const unit = /^Environment=([A-Z][A-Z0-9_]*)=(\S*)$/gm;
    for (const [, name, raw] of text.matchAll(unit)) push(name, raw);
  }
  return out;
}

/**
 * A documented variable that nothing reads. Assigning it is not reading it: the
 * server unit used to spell out `--ctx-size 4096` while .env.example offered
 * MURMUR_LLAMACPP_CTX, so the variable was loaded into the environment and
 * ignored. This is the rule that would have said so.
 */
export function documentedButUnread(
  doc: string,
  sources: Map<string, string>,
): string[] {
  return [...documentedVars(doc).keys()].filter(
    (name) => !isRead(name, sources),
  );
}

/** Whether the name appears in a read position anywhere. */
function isRead(name: string, sources: Map<string, string>): boolean {
  for (const text of sources.values()) {
    if (new RegExp(`process\\.env\\.${name}\\b`).test(text)) return true;
    if (new RegExp(`\\$\\{?${name}\\b`).test(text)) return true;
  }
  return false;
}

/**
 * A variable the code reads that the document never mentions. The mirror of
 * documentedButUnread, because a knob nobody documented is a knob nobody knows
 * to turn.
 *
 * Shell locals are excluded. deepen-night.sh sets BUN, CARDS, UNIT and REPO_DIR
 * itself, and $CARDS is a read of a local, not of an environment variable; without
 * this every script-local would be reported as an undocumented setting.
 */
export function readButUndocumented(
  doc: string,
  sources: Map<string, string>,
): string[] {
  const documented = new Set(documentedVars(doc).keys());
  const read = new Set<string>();
  for (const [path, text] of sources) {
    for (const [, name] of text.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (name) read.add(name);
    }
    // $NAME only means an environment variable in shell and in a unit file. In
    // TypeScript it is nearly always a template substitution of a local const —
    // ${LLAMACPP_URL} is a const called LLAMACPP_URL, not a variable MURMUR_ ever
    // set — so the whole line is DEEPENED_LIMIT, JSON and PILLARS by another name.
    if (!path.endsWith(".ts")) {
      const assignedHere = new Set(
        [...text.matchAll(/^\s*([A-Z][A-Z0-9_]*)=/gm)].map(([, n]) => n),
      );
      for (const [, name] of text.matchAll(/\$\{?([A-Z][A-Z0-9_]*)\b/g)) {
        // PATH and HOME belong to systemd, not to us; naming them in .env.example
        // would be advice about the machine rather than about this app.
        if (name && name !== "PATH" && name !== "HOME" && !assignedHere.has(name)) {
          read.add(name);
        }
      }
    }
  }
  return [...read].filter((name) => !documented.has(name)).sort();
}

/**
 * A documented value that disagrees with the default in the code, or with the
 * default in some other place. Comparing every source to every other is the
 * point: one stale number is a lie, two disagreeing numbers are a bug waiting
 * for the day they are read by different programs.
 */
export function envValueDrift(
  doc: string,
  defaults: Map<string, string[]>,
): string[] {
  const problems: string[] = [];
  for (const [name, value] of documentedVars(doc)) {
    for (const candidate of defaults.get(name) ?? []) {
      if (candidate !== value) {
        problems.push(`${name}: .env.example says ${value}, the code defaults to ${candidate}`);
      }
    }
  }
  return problems;
}

/**
 * The README states the size of the corpus and the number of tests. Those move
 * on their own — the deepener adds a card every night — so a number written
 * down there is a number that is wrong by morning. Only the facts that cannot
 * move without a commit are checked: the seed count, the cap, and the size of the
 * closed vocabulary.
 *
 * The vocabulary is checked by count, not by name. An earlier version required
 * every one of the 65 tags to appear in the README, which would have meant a
 * 65-word list of tags in prose forever, to defend against a number that only
 * moves when someone commits an edit anyway. "Six categories, 65 tags" is the
 * right claim to make, and the check is that it stays true.
 */
const NUMBER_WORDS = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
];

/**
 * The count the document states beside a label, as a number. "six categories" and
 * "6 categories" are the same claim. Returns undefined when it states none.
 *
 * The comparison has to be the stated number against the expected one, not the
 * expected number against the text: asking whether the README contains "65 tags"
 * is satisfied just as well by a README that is wrong about the count.
 *
 * The look-behind stops at a comma. "Six categories, 65 tags" is one sentence
 * about two counts, and a gap wide enough to cross the comma reads the tag count
 * as the category count.
 */
function statedCount(readme: string, label: string): number | undefined {
  const digits = new RegExp(`\\b(\\d+)\\s+${label}\\b`, "i").exec(readme);
  if (digits?.[1]) return Number(digits[1]);
  const before = new RegExp(`\\b${label}\\b[^.,\\n]{0,12}?\\b(\\d+)\\b`, "i").exec(readme);
  if (before?.[1]) return Number(before[1]);
  for (const [index, word] of NUMBER_WORDS.entries()) {
    if (word === "") continue;
    if (new RegExp(`\\b${word}\\s+${label}\\b`, "i").test(readme)) return index;
  }
  const after = new RegExp(
    `\\b${label}\\b[^.,\\n]{0,12}?\\b(${NUMBER_WORDS.filter(Boolean).join("|")})\\b`,
    "i",
  ).exec(readme);
  const found = after?.[1];
  return found ? NUMBER_WORDS.indexOf(found.toLowerCase()) : undefined;
}

export function readmeDrift(readme: string): string[] {
  const problems: string[] = [];

  if (!readme.includes(`${SEED_IDEAS.length} hand-written`)) {
    problems.push(`README does not say the corpus starts at ${SEED_IDEAS.length} hand-written cards`);
  }
  if (!readme.includes(`capped at ${DEEPENED_LIMIT} cards`)) {
    problems.push(`README does not say the pool is capped at ${DEEPENED_LIMIT} cards`);
  }
  const categories = statedCount(readme, "categor(?:y|ies)");
  if (categories !== CATEGORIES.length) {
    problems.push(
      categories === undefined
        ? `README does not say how many categories there are`
        : `README says ${categories} categories; there are ${CATEGORIES.length}`,
    );
  }
  const tags = statedCount(readme, "tags?");
  if (tags !== TAGS.length) {
    problems.push(
      tags === undefined
        ? `README does not say how many tags there are`
        : `README says ${tags} tags; there are ${TAGS.length}`,
    );
  }
  return problems;
}

/**
 * Two sources disagreeing about one variable's default. This is a different
 * hazard from the documented value being stale, and the document cannot catch it
 * by being right: the server unit and the deepen script each fall back
 * independently, so a port that reads 11436 in both places today can become
 * 11436 in one and 9999 in the other with every documented value still correct.
 * The symptom is a model server running perfectly well that nothing can reach.
 */
export function defaultsDisagree(defaults: Map<string, string[]>): string[] {
  return [...defaults]
    .filter(([, values]) => values.length > 1)
    .map(([name, values]) => `two sources default ${name} differently: ${values.join(" and ")}`);
}

/**
 * The port the server binds and the port a client dials are the same fact told
 * twice. They are configured separately, so nothing stops them drifting, and
 * when they do the failure is a connection refused against a model that is
 * running perfectly well.
 */
export function urlPortDrift(doc: string, defaults: Map<string, string[]>): string[] {
  const documented = documentedVars(doc);
  const url = documented.get("MURMUR_LLAMACPP_URL");
  const port = documented.get("MURMUR_LLAMACPP_PORT") ?? defaults.get("MURMUR_LLAMACPP_PORT")?.[0];
  if (!url || !port) return [];
  const inUrl = /:(\d+)\/?$/.exec(url)?.[1];
  return inUrl !== undefined && inUrl !== port
    ? [`MURMUR_LLAMACPP_URL ends in :${inUrl} but the server binds :${port}`]
    : [];
}

describe("the docs and the code agree", () => {
  const doc = read(join(ROOT, ".env.example"));
  const readme = read(join(ROOT, "README.md"));
  const sources = new Map(sourceFiles().map((path) => [path, read(path)]));
  const defaults = declaredDefaults(sources);

  it("has sources to check", () => {
    // Without this every check below passes on an empty map, which is the shape
    // of a gate that has never fired.
    expect(sources.size).toBeGreaterThan(10);
    expect(defaults.size).toBeGreaterThan(10);
  });

  it("has no variable the code reads and .env.example never mentions", () => {
    expect(readButUndocumented(doc, sources)).toEqual([]);
  });

  it("has no variable .env.example offers that nothing reads", () => {
    expect(documentedButUnread(doc, sources)).toEqual([]);
  });

  it("has no documented value that contradicts a default in the code", () => {
    expect(envValueDrift(doc, defaults)).toEqual([]);
  });

  it("has no two sources defaulting the same variable differently", () => {
    expect(defaultsDisagree(defaults)).toEqual([]);
  });

  it("has a client URL pointing at the port the server binds", () => {
    expect(urlPortDrift(doc, defaults)).toEqual([]);
  });

  it("has a README that states only the facts which cannot move on their own", () => {
    expect(readmeDrift(readme)).toEqual([]);
  });
});

describe("the doc checks can fail", () => {
  const good = "MURMUR_DEEPEN_COUNT=12\n";
  const sources = new Map([["a.ts", 'process.env.MURMUR_DEEPEN_COUNT ?? "12"']]);

  it("catches a documented value the code no longer defaults to", () => {
    // This is the exact defect that shipped: the script moved to 12, the
    // document stayed at 6.
    expect(envValueDrift("MURMUR_DEEPEN_COUNT=6\n", declaredDefaults(sources))).toEqual([
      "MURMUR_DEEPEN_COUNT: .env.example says 6, the code defaults to 12",
    ]);
  });

  it("catches a variable offered as a knob that nothing reads", () => {
    // The exact defect that shipped: MURMUR_LLAMACPP_CTX, assigned into the unit's
    // environment and then ignored because ExecStart spelled the number out.
    const unit = new Map([["unit", "Environment=MURMUR_LLAMACPP_CTX=4096"]]);
    expect(documentedButUnread("MURMUR_LLAMACPP_CTX=4096\n", unit)).toEqual([
      "MURMUR_LLAMACPP_CTX",
    ]);
  });

  it("catches a variable the code reads and the document never mentions", () => {
    // The exact defect that shipped: MURMUR_LLAMACPP_MAX_TOKENS, read by the
    // provider and documented nowhere.
    const code = new Map([["p.ts", "numberOr(process.env.MURMUR_LLAMACPP_MAX_TOKENS, 1200)"]]);
    expect(readButUndocumented("MURMUR_DEEPEN_COUNT=12\n", code)).toEqual([
      "MURMUR_LLAMACPP_MAX_TOKENS",
    ]);
  });

  it("compares every source against the document, not just the first", () => {
    // Three different numbers for one variable, in three different files: all
    // three have to come back, or the check is only reading one source.
    const split = new Map([
      ["server.service", "Environment=MURMUR_LLAMACPP_PORT=11436"],
      ["deepen.sh", 'PORT="${MURMUR_LLAMACPP_PORT:-11436}"'],
      ["provider.ts", 'process.env.MURMUR_LLAMACPP_PORT ?? "8080"'],
    ]);
    expect(envValueDrift("MURMUR_LLAMACPP_PORT=9999\n", declaredDefaults(split))).toHaveLength(2);
  });

  it("catches two sources defaulting one variable differently", () => {
    // The document is right in this case and the code is still wrong: the server
    // would bind 11436 while the deepener health-checked 9999.
    const split = new Map([
      ["server.service", "Environment=MURMUR_LLAMACPP_PORT=11436"],
      ["deepen.sh", 'PORT="${MURMUR_LLAMACPP_PORT:-9999}"'],
    ]);
    expect(defaultsDisagree(declaredDefaults(split))).toEqual([
      "two sources default MURMUR_LLAMACPP_PORT differently: 11436 and 9999",
    ]);
  });

  it("catches a client URL pointing at a port nothing binds", () => {
    const doc = "MURMUR_LLAMACPP_URL=http://127.0.0.1:9999\nMURMUR_LLAMACPP_PORT=11436\n";
    expect(urlPortDrift(doc, new Map())).toEqual([
      "MURMUR_LLAMACPP_URL ends in :9999 but the server binds :11436",
    ]);
  });

  it("catches a README whose stated vocabulary size is out of date", () => {
    const facts = (categories: string, tags: string) =>
      `${SEED_IDEAS.length} hand-written pool itself is capped at ${DEEPENED_LIMIT} cards ` +
      `${categories} categories, ${tags} tags`;
    expect(readmeDrift(facts(String(CATEGORIES.length), String(TAGS.length)))).toEqual([]);
    expect(readmeDrift(facts(String(CATEGORIES.length), String(TAGS.length + 3)))).toEqual([
      `README says ${TAGS.length + 3} tags; there are ${TAGS.length}`,
    ]);
    expect(readmeDrift(facts(String(CATEGORIES.length + 1), String(TAGS.length)))).toEqual([
      `README says ${CATEGORIES.length + 1} categories; there are ${CATEGORIES.length}`,
    ]);
  });

  it("reads a spelled-out count, not just digits", () => {
    const spelled = `${SEED_IDEAS.length} hand-written pool itself is capped at ${DEEPENED_LIMIT} cards ` +
      `${NUMBER_WORDS[CATEGORIES.length]} categories, ${TAGS.length} tags`;
    expect(readmeDrift(spelled)).toEqual([]);
  });

  it("catches a README that drifted to the wrong seed count", () => {
    const readme = read(join(ROOT, "README.md")).replace(
      `${SEED_IDEAS.length} hand-written`,
      `${SEED_IDEAS.length - 5} hand-written`,
    );
    expect(readmeDrift(readme)).toContain(
      `README does not say the corpus starts at ${SEED_IDEAS.length} hand-written cards`,
    );
  });
});