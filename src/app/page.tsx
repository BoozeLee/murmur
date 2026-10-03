import { Deck } from "@/components/deck";
import { allIdeas } from "@/lib/corpus/deepened";
import { getStore } from "@/lib/store";

/**
 * The server reads the shelf before the page is sent, so the first paint already
 * knows what she has kept. The deck itself is client-side because a draw can take
 * ten seconds against the local model and must not block navigation.
 */
export const dynamic = "force-dynamic";

export default async function Home(): Promise<React.ReactElement> {
  const store = getStore();
  const [saved, stats] = await Promise.all([store.listSaved(), store.stats()]);
  return (
    <main>
      <Deck initialSaved={saved} initialStats={stats} corpusSize={allIdeas().length} />
    </main>
  );
}