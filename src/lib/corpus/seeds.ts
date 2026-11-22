import type { IdeaDraft } from "../schema";

/**
 * The curated corpus.
 *
 * Organising principle: every idea belongs to one of six subject pillars —
 * architecture, design, engineering, development, intelligence, mechanics.
 * The painting category (landscape/portrait/abstract/figurative/illustration/
 * still-life) is a secondary axis for filtering; the mood tags are the third.
 *
 * The pillars are the *subject matter*. The mood tags are the finish. A pilot
 * can be an abandoned cathedral (architecture) that reads as mystic and
 * ethereal — that combination is what the filters need to be able to express.
 *
 * This corpus exists for two reasons beyond taste:
 *  1. The app is useful with zero AI. If Ollama is down, the deck still works.
 *  2. It seeds the model with real examples, so generated ideas match the tone
 *     instead of defaulting to generic "moody landscape #14".
 */
export const SEED_IDEAS: IdeaDraft[] = [
  // ── ARCHITECTURE ──────────────────────────────────────────────────────────
  {
    title: "Cathedral Whose Buttresses Are Teeth",
    category: "landscape",
    tags: ["architectural", "cathedral", "mystic", "monochrome"],
    concept:
      "The exterior of a gothic cathedral, but every flying buttress has become a row of enormous carved teeth. The building is still holy; the supports have become predatory.",
    tension:
      "Keep it reading as reverence, not as a monster. The mouth must be architectural, symmetrical and stone — the horror is entirely in how literal the teeth are.",
    light: "Low sun raking across the stone from the left, catching only the incisors.",
    palette: ["bone white", "grey-green", "soot", "one thin line of gold at the horizon"],
    composition:
      "Three-quarter exterior, building filling the frame, sky reduced to a slit above it.",
    medium: "Gouache on prepared board, dry-brushed",
    prompt: "A cathedral whose flying buttresses are carved stone teeth. Reverent, not monstrous.",
    scale: "Cathedral-sized; the teeth are as tall as the nave.",
    referenceAngle: "Look at the underside of a stone arch for how weight reads as honesty.",
    pitfalls: ["Teeth too cartoonish and it becomes a Halloween graphic."],
  },
  {
    title: "Brutalist Observatory, No One Inside",
    category: "landscape",
    tags: ["architectural", "industrial", "astronomic", "shadow"],
    concept:
      "A brutalist concrete observatory on a salt flat, its dome slit open to the sky. Every window is dark. The telescope inside has been aimed at nothing in particular.",
    tension:
      "The scale has to feel abandoned, not monumental. Keep the human absence total — no footprints, no vehicles, no birds.",
    light: "Milky way directly overhead, no moon, so the concrete reads only as silhouette.",
    palette: ["concrete grey", "star-field white", "salt flat violet", "matte black"],
    composition:
      "Astronomically low viewpoint, building small in a huge sky — the sky is the subject, the building is the excuse.",
    medium: "Acrylic, thin washes, dry brush",
    prompt:
      "An abandoned brutalist observatory under the milky way. The telescope aims at nothing.",
    scale: "Small building, enormous sky.",
    referenceAngle: "Go outside at 2am once. Note how much darker 'dark' is than you expect.",
    pitfalls: ["Sky too bright and the building stops feeling alone."],
  },
  {
    title: "Iron Cathedral Underwater",
    category: "landscape",
    tags: ["architectural", "cathedral", "submerged", "mystic"],
    concept:
      "A vast iron cathedral structure resting on a seabed, its rose window intact. Sunlight falls through the window onto the silt, and the light it casts has become the only living thing down there.",
    tension:
      "The iron must look like it was always meant to be submerged — corroded in the patterns water makes, not generic rust.",
    light:
      "A single hard shaft through the rose window, with visible suspended particles making the beam solid.",
    palette: ["deep teal", "iron oxide orange", "silt grey", "the light itself: pale gold"],
    composition:
      "Wide, with the cathedral small and low in frame, the light beam crossing the entire composition diagonally.",
    medium: "Gouache, layered glazing",
    prompt:
      "A sunken iron cathedral. Sunlight through its rose window is the only living thing left.",
    scale: "Cathedral on a seabed; the beam spans the whole width.",
    referenceAngle:
      "Photograph a real rusted iron sheet under water if you can get near any water.",
    pitfalls: ["Beam too neat — it needs the mess of floating particles."],
  },
  {
    title: "Blueprint for a Temple That Never Was",
    category: "abstract",
    tags: ["blueprint", "architectural", "esoteric", "ghost"],
    concept:
      "A technical drawing of an impossible building, left on the drafting table so long the ink has bled, faded and started growing its own faint secondary lines — a second design nobody drew.",
    tension:
      "The second set of lines must look like a consequence of the first, not a doodle. Same geometry, wrong proportion.",
    light: "Flat, raking side-light across the paper so the bleed and the paper texture both read.",
    palette: ["prussian blue", "paper cream", "oxblood correction marks", "graphite silver"],
    composition: "Flat overhead, the sheet filling frame, edges of the table just visible.",
    medium: "Ink and coloured pencil on rag paper",
    prompt:
      "A blueprint of an impossible building, its ink bleeding into a ghost second design nobody drew.",
    scale: "A single drafting sheet.",
    referenceAngle: "Search 'anaerobic blueprint' — old drawings darken with age in streaks.",
    pitfalls: ["Too neat. The bleed is the whole idea."],
  },
  {
    title: "Reliquary of the Machine That Failed",
    category: "still-life",
    tags: ["mechanical", "engineered", "sacred-geometry", "alchemical"],
    concept:
      "A disassembled engine component arranged on a velvet altar cloth like a saint's relic: brass rings, a cracked flywheel, seven screws in a perfect heptagon.",
    tension:
      "Treat it with genuine reverence. The tension only works if the object is treated as holy, not as scrap.",
    light:
      "A single hard warm source from one side, like a candle in a side chapel; the rest falls to near-black.",
    palette: ["brass", "deep velvet red", "oil black", "candle amber"],
    composition: "Overhead, symmetrical, sparse — a lot of empty velvet around few objects.",
    medium: "Oil on panel, high detail, dark ground",
    prompt:
      "A broken engine component arranged on velvet like a relic. Brass, heptagon of screws, candlelight.",
    scale: "Small objects, vast empty cloth.",
    referenceAngle:
      "Old-master still-life lighting references; the falloff into black is the trick.",
    pitfalls: ["Too many objects. Restraint is what makes it an altar."],
  },
  {
    title: "Library Stacks Built for a Larger Being",
    category: "landscape",
    tags: ["architectural", "cognitive", "shadow", "geometric"],
    concept:
      "A vast library whose shelves, ladders and reading desks are all scaled for something fifteen feet tall. No chair is the right height for a person. The books are enormous.",
    tension:
      "You must never show the giant. The entire effect depends on the absence — the reader's absence — inferred purely from scale mismatch.",
    light: "High clerestory light in dusty shafts, deep shadow in the stacks.",
    palette: ["old paper", "walnut", "dust gold", "green-shadowed dark"],
    composition: "Low angle, looking up the shelves so the scale keeps climbing out of frame.",
    medium: "Acrylic, layered, soft edges",
    prompt: "A library scaled for a being fifteen feet tall. Nobody is here. The books are huge.",
    scale: "Vaulted, endless, built for giants.",
    referenceAngle:
      "Measure a familiar bookshelf against your own reach to internalise the mismatch.",
    pitfalls: ["Showing a person for scale destroys the illusion instantly."],
  },

  // ── DESIGN ────────────────────────────────────────────────────────────────
  {
    title: "The Design Sketch Nobody Executed",
    category: "abstract",
    tags: ["design", "blueprint", "negative-space", "esoteric"],
    concept:
      "A beautiful design drawing — form, proportion, everything resolved — next to the blank rectangle where it should have been built. The empty space is the subject.",
    tension:
      "The drawing must be good enough that the viewer feels the loss. Mediocre linework turns the void into indifference instead of regret.",
    light: "Neutral, even, museum-flat — this is a work on paper, not a scene.",
    palette: [
      "graphite",
      "paper white",
      "one accent of vermilion",
      "the empty rectangle as pure white",
    ],
    composition: "Drawing on the left third, empty rectangle dominating the right two-thirds.",
    medium: "Graphite and coloured pencil on paper",
    prompt:
      "A perfect design drawing beside the blank space where it should have been. The absence is the subject.",
    scale: "Two sheets on a table.",
    referenceAngle:
      "Look at how much empty margin Japanese designers leave — the void is designed too.",
    pitfalls: ["Filling the empty rectangle, even with a pale wash."],
  },
  {
    title: "Grid That Grew a Forest",
    category: "abstract",
    tags: ["design", "geometric", "botanical", "fractal"],
    concept:
      "A precise modular grid, drawn with technical discipline, where certain cells have quietly stopped obeying it and grown into organic branching forms. The grid is not broken — it is being outgrown.",
    tension:
      "The organic forms must still snap to the grid's rhythm at their edges. Total escape looks like a different painting.",
    light: "Flat and even; let the drawing carry it.",
    palette: ["ink black", "paper", "one green", "the green is too saturated on purpose"],
    composition:
      "Full-bleed grid, the mutations clustered off-centre following an invisible diagonal.",
    medium: "Ink and gouache on paper",
    prompt: "A modular grid being quietly outgrown by organic forms that still obey its rhythm.",
    scale: "Single sheet.",
    referenceAngle:
      "Study Islamic geometric tiling for the underlying lattice beneath the pattern.",
    pitfalls: ["Organic forms drifting off the lattice entirely."],
  },
  {
    title: "Poster for a Festival That Is Only a Rumour",
    category: "illustration",
    tags: ["design", "graphic", "esoteric", "chrome"],
    concept:
      "A screen-printed poster for an event no one can confirm exists. Confident typography, immaculate grid, one impossible image. It looks like an announcement of nothing.",
    tension:
      "It has to look professionally credible. Sloppiness would make it obviously fictional; the unsettling read only comes from polish.",
    light:
      "Printed — flat colour, no modelled light at all, except inside the one impossible image.",
    palette: ["2 inks only: orange and black", "paper cream", "the orange used sparingly"],
    composition: "Classical poster grid — image top two-thirds, type block bottom third.",
    medium: "Screenprint simulation — flat layers, slight misregistration",
    prompt:
      "A perfectly credible poster for an event no one can confirm exists. Two inks. One impossible image.",
    scale: "A2 poster.",
    referenceAngle: "Swiss poster grids; also look at misregistration on real screenprints.",
    pitfalls: ["Three inks instead of two — the constraint is the idea."],
  },
  {
    title: "Type Specimen for a Language Nobody Speaks",
    category: "abstract",
    tags: ["design", "graphic", "esoteric", "mystery"],
    concept:
      "A type foundry's specimen sheet for a script with no known speakers. Every glyph is drawn with obsessive care. Someone has kerned this alphabet by hand, letter by letter.",
    tension:
      "The letters must suggest meaning without resolving into any real script. Too familiar and it becomes a font; too abstract and the care is lost.",
    light: "Even specimen-sheet lighting. Flat.",
    palette: ["black ink", "cream stock", "a single registration-red accent"],
    composition:
      "Traditional specimen layout — giant character, then the character set, then a water-fall row.",
    medium: "Digital or ink, precise, no brush character",
    prompt:
      "A type specimen sheet for a script with no speakers. Every glyph kerned by hand. Obsessive care.",
    scale: "One sheet.",
    referenceAngle: "Real foundry specimen sheets; the water-fall row is the tell.",
    pitfalls: ["Letters becoming readable as Latin and killing the mystery."],
  },
  {
    title: "Colour System for Emotions Nobody Has Had",
    category: "abstract",
    tags: ["design", "graphic", "geometric", "cognitive"],
    concept:
      "A colour system — swatches, ramps, rules of combination — for a set of emotions that don't exist in any language. Precise, systematic, and entirely unusable.",
    tension:
      "It must be systematic enough that a viewer believes it could work. A pretty gradient with no rules reads as decoration.",
    light: "Flat, sample-board neutral.",
    palette: ["three flat colour swatches", "the winning combination", "the plain ground"],
    composition: "Modular swatch grid, with one combination applied as a small painted square.",
    medium: "Flat acrylic on panel, no brush texture",
    prompt:
      "A rigorous colour system for emotions no language has words for. Swatches, ramps, rules.",
    scale: "Grid of small squares.",
    referenceAngle: "Munsell colour-system charts for the rigour of the layout.",
    pitfalls: ["Any visible emotion — the whole point is that none can be felt."],
  },

  // ── ENGINEERING ───────────────────────────────────────────────────────────
  {
    title: "Bridge Built by Something That Should Not Understand Bridges",
    category: "landscape",
    tags: ["engineered", "architectural", "mystery", "atmospheric"],
    concept:
      "A cable-stayed bridge of impossible elegance spanning a gorge, built to a standard no engineer would accept — too thin, too light, carrying a load it has no right to carry.",
    tension:
      "It must not collapse. Every instinct says to add weight; resist, and make the lightness look deliberate rather than precarious.",
    light: "Flat overcast, no sun — form described entirely by aerial perspective.",
    palette: ["concrete grey", "moss green", "river slate", "faint rust at the joints"],
    composition: "Pure side elevation, architectural, almost diagram-like.",
    medium: "Ink and wash, precise line",
    prompt:
      "An impossibly elegant cable-stayed bridge, too thin for its load, spanning a gorge under flat light.",
    scale: "Gorge-scale, seen end-on.",
    referenceAngle: "Actual suspension bridge photographs for cable geometry and tower proportion.",
    pitfalls: ["Adding drama. Flat light is what makes it read as engineered."],
  },
  {
    title: "Structural Failure, Formal",
    category: "abstract",
    tags: ["engineered", "geometric", "chiaroscuro", "abstract"],
    concept:
      "A load-bearing structure caught in the exact millisecond of buckling — one strut bent past its limit, the whole system still holding, nothing yet fallen.",
    tension:
      "Freeze it in the instant before collapse, not during. Collapse is dramatic and finished; the millisecond before is tense and unresolved.",
    light: "Hard raking light along the bent strut so the deformation is the brightest thing.",
    palette: ["steel", "rust", "one cold blue shadow", "high-key background"],
    composition: "Radial, force lines drawn visually from the bent member.",
    medium: "Acrylic, hard edges, masked",
    prompt:
      "A structure in the millisecond before buckling. One strut bent past its limit. Everything still holding.",
    scale: "Close enough to see the bend clearly.",
    referenceAngle:
      "Slow-motion footage of buckling tests — the shape before failure is the whole subject.",
    pitfalls: ["Drawing the failure. Draw the instant before."],
  },
  {
    title: "Machine Designed for a Task Nobody Remembers",
    category: "still-life",
    tags: ["engineered", "mechanical", "esoteric", "industrial"],
    concept:
      "A large elegant machine of unknown purpose. Every part is beautifully made. No part connects to any other part's function in a way you can follow. It is unmistakably *for* something.",
    tension:
      "Keep the function illegible but the craft legible. The instant it becomes obviously a guillotine or a press, the mystery evaporates.",
    light: "Single warm source, deep falloff, the way a workshop lamp would actually sit.",
    palette: ["brass", "oiled steel", "deep green machine paint", "lamp amber"],
    composition: "Three-quarter, cluttered but legible, cropped so it extends beyond the frame.",
    medium: "Oil, glazed, high finish",
    prompt:
      "A large elegant machine of unknown purpose. Beautiful craft, no followable function. For something.",
    scale: "Room-filling.",
    referenceAngle: "Museum machines —.orreries, harmonic analysers, tide-predictors.",
    pitfalls: ["Making it obviously a real machine you can name."],
  },
  {
    title: "Turbine Hall, Empty",
    category: "landscape",
    tags: ["engineered", "industrial", "cathedral", "shadow"],
    concept:
      "The interior of a decommissioned turbine hall — vast, vaulted, echoing. Every turbine removed. The floor is clean. It reads as a cathedral that lost its congregation.",
    tension:
      "Empty must mean *deliberately* empty. Not abandoned — emptied, on purpose. No debris, no rust streaks running anywhere.",
    light:
      "High windows throwing long parallel light-floors across the floor; the far end in darkness.",
    palette: ["oxidised copper", "grey-green", "light-floor gold", "deep end-shadow"],
    composition: "One-point perspective straight down the hall axis.",
    medium: "Acrylic, transparent glazes, dry brush for the light-floors",
    prompt:
      "A decommissioned turbine hall, every turbine removed, spotless floor. A cathedral that lost its congregation.",
    scale: "Vast, vaulted, echoing.",
    referenceAngle: "Locomotives sheds and turbine halls for the parallel light-floors.",
    pitfalls: ["Adding rubble. Emptied, not abandoned."],
  },
  {
    title: "The Load-Bearing Myth",
    category: "abstract",
    tags: ["engineered", "geometric", "sacred-geometry", "esoteric"],
    concept:
      "A structural diagram — the kind an engineer draws to prove a shape will hold — rendered as an esoteric mandala. Triangulation becomes sacred geometry.",
    tension:
      "It must remain a *valid* structural diagram. Break the physics and the engineer reads it as decoration; keep the physics and the esoteric reading arrives unforced.",
    light: "Flat, technical. No atmosphere at all.",
    palette: ["drafting blue or graphite", "white", "one line of gold for the load path"],
    composition: "Perfectly centred, radial, symmetrical.",
    medium: "Technical pen and a ruler, plus one hand-drawn gold line",
    prompt:
      "A real structural triangulation diagram rendered as a mandala. Valid physics, esoteric reading.",
    scale: "One sheet.",
    referenceAngle:
      "Look up how a truss is actually drawn — the triangulation is already beautiful.",
    pitfalls: ["Loosening the joints so it reads as art, not engineering."],
  },

  // ── DEVELOPMENT ───────────────────────────────────────────────────────────
  {
    title: "City Under Construction, Two Thousand Years Apart",
    category: "landscape",
    tags: ["development", "architectural", "ruin", "time"],
    concept:
      "The same plot shown at two moments: a foundation trench being dug, and a cathedral half-built on that exact trench two thousand years later. Both in the same frame, edge to edge.",
    tension:
      "They must read as the *same place* — keep one identical detail (a wall stub, a pipe) crossing the seam. Continuity sells the time jump.",
    light: "One sun angle, identical in both halves. Any difference breaks the illusion.",
    palette: ["raw earth ochre", "aged stone", "one shared shadow colour"],
    composition: "Hard vertical split down the middle; the seam is the composition.",
    medium: "Acrylic, flat, hard-edged",
    prompt:
      "A foundation trench and a half-built cathedral on the same plot, in one frame, one light angle.",
    scale: "City block.",
    referenceAngle: "Match one continuous element across both halves — a rebar stub does it.",
    pitfalls: ["Different light angles in the two halves."],
  },
  {
    title: "Growth Diagram of an Unbuilt Thing",
    category: "illustration",
    tags: ["development", "blueprint", "botanical", "growth"],
    concept:
      "A grower's chart — the kind that maps how a plant develops over a season — but for a building. Stacked cross-sections show it at nine stages, from foundation to a form that was never reached.",
    tension:
      "The final stage must be the weakest one. The chart has to admit the project failed, without a single written word of commentary.",
    light: "Flat, instructional.",
    palette: ["ink", "paper", "aged sepia for the dead final stage"],
    composition: "Vertical stack of nine cross-sections, uniform scale, aligned.",
    medium: "Ink and wash, scientific-illustration precision",
    prompt:
      "A grower's chart for a building. Nine cross-sections, foundation to a final stage that never happened.",
    scale: "One chart.",
    referenceAngle: "Real botanical grower's charts; copy their grid discipline.",
    pitfalls: ["Making the last stage a triumphant apex instead of a failure."],
  },
  {
    title: "What the Prototype Learned",
    category: "still-life",
    tags: ["development", "engineered", "memory", "geometric"],
    concept:
      "A row of test objects on a bench, each an earlier version of the same design, ending in the one that worked. The failed ones are not discarded — they are lined up, in order, out of respect.",
    tension:
      "Give every version equal weight and lighting. Hierarchy would imply the later one won; equality implies each taught something.",
    light: "Even, catalogue-like, across the whole row.",
    palette: ["neutral bench", "one colour, seven versions", "one accent"],
    composition: "Strict elevation, evenly spaced, photographed straight on.",
    medium: "Oil, precise, neutral",
    prompt:
      "Seven versions of the same object lined up on a bench in order. The failures kept, not discarded.",
    scale: "Hand-sized objects.",
    referenceAngle: "Museum development collections; the row is the composition.",
    pitfalls: ["Making the final one obviously better lit or larger."],
  },
  {
    title: "Blueprint Burns Slowly From the Edges",
    category: "landscape",
    tags: ["development", "blueprint", "decay", "flora"],
    concept:
      "A full architectural drawing laid flat on the ground, and the grass is growing up through it — the ink dissolving upward into actual growth. The building is becoming a meadow.",
    tension:
      "Keep the drawing readable where it survives. If it dissolves entirely there is no loss, just a transition; partial survival is what hurts.",
    light: "Low sun, so the surviving ink catches it and the growth glows at the tips.",
    palette: ["prussian blue", "green", "ochre dead grass", "warm sun on both"],
    composition: "Flat overhead on the ground plane, drawing running off the top edge of frame.",
    medium: "Gouache, wet-in-wet at the growth edge",
    prompt:
      "A blueprint lying on the ground, grass growing up through it. Partly readable. The building becoming a meadow.",
    scale: "Ground plane, life-size.",
    referenceAngle:
      "Real photographs of paper degrading outdoors; the partial states are the good ones.",
    pitfalls: ["Dissolving the whole sheet."],
  },
  {
    title: "Sequence of a Machine Learning to Move",
    category: "illustration",
    tags: ["development", "machine", "chiaroscuro", "geometric"],
    concept:
      "Nine panels showing a machine attempting a simple motion. It fails the same way eight times, then succeeds once, crudely. The success is not the happy ending — it's the most awkward frame.",
    tension:
      "Make the successful frame genuinely clumsy. A graceful success turns this into a triumph; an awkward one keeps it honest.",
    light: "Hard identical lighting across all nine panels, like sequential photography.",
    palette: ["monochrome", "the successful frame alone in colour", "black ground"],
    composition: "3×3 grid, identical camera position in every panel.",
    medium: "Ink, sequential, mechanical consistency",
    prompt:
      "Nine panels of a machine failing the same motion eight times, then succeeding clumsily in the ninth.",
    scale: "Nine equal frames.",
    referenceAngle:
      " Muybridge and Marey chronophotography — identical fixed camera, that's the tradition.",
    pitfalls: ["Making panel nine elegant."],
  },
  {
    title: "Excavation With the Building Still Intended",
    category: "landscape",
    tags: ["development", "engineered", "architectural", "shadow"],
    concept:
      "A construction pit dug beside a finished building, and the pit is a perfect negative of it — an exact void waiting to become its twin. Both structures are equally real.",
    tension:
      "The void must be unmistakably the same building. Off by one proportion and it becomes an unrelated hole.",
    light: "Flat, so the geometry reads as geometry.",
    palette: ["raw earth", "the pit repeats the building's material", "grey sky"],
    composition: "Symmetrical, the pit and the building as mirror halves.",
    medium: "Acrylic, flat planes",
    prompt:
      "A construction pit that is an exact negative of the finished building beside it. Both equally real.",
    scale: "One building and one hole the size of it.",
    referenceAngle: "Set-dressing photos; the mirrored pair must be photographed from a true axis.",
    pitfalls: ["Pit shape drifting from the building's."],
  },

  // ── INTELLIGENCE ──────────────────────────────────────────────────────────
  {
    title: "Machine That Dreams of Its Maker",
    category: "figurative",
    tags: ["intelligence", "machine", "cognitive", "mystic"],
    concept:
      "A humanoid machine seated alone, its cranial casing open, light inside where a brain would be. Its hands are open in its lap. It is not performing anything. It is remembering.",
    tension:
      "It must read as interior and private, not as a robot on display. No stance, no gesture towards the viewer.",
    light:
      "The only light source is inside its open head, lighting its own face and hands from below.",
    palette: [
      "black interior",
      "cold machine grey",
      "warm internal glow",
      "deep blue-black shadow",
    ],
    composition: "Seated figure, low, centred, generous empty space above the head.",
    medium: "Oil on canvas, dark ground, single light source",
    prompt:
      "A humanoid machine seated alone, cranium open, light inside. Its only light source is its own mind. Remembering.",
    scale: "Human-sized.",
    referenceAngle: "Rembrandt single-source lighting references.",
    pitfalls: ["Glowing eyes instead of an open cranium — too sci-fi, less intimate."],
  },
  {
    title: "The Network Has a Shape",
    category: "abstract",
    tags: ["intelligence", "cognitive", "geometric", "botanical"],
    concept:
      "A distributed network rendered as a single root system seen in section — the underground architecture of something that thinks. Nodes glow faintly. It is a mind, and it is also a plant.",
    tension:
      "Do not draw circuit traces. The moment it becomes electronics it stops being alive; the botanical reading has to survive.",
    light: "Subsurface glow from the nodes, dark soil above.",
    palette: [
      "soil black",
      "bioluminescent cyan-green",
      "root ochre",
      "faint blue sky at the very top",
    ],
    composition: "Cross-section, horizon high in frame, roots filling the lower two-thirds.",
    medium: "Gouache, glazing, wet-in-wet glow",
    prompt:
      "A distributed network drawn as a root system in section. A mind that is also a plant. Faint nodes.",
    scale: "Below one small field.",
    referenceAngle: "Root cross-section photos for branching density.",
    pitfalls: ["Making it look like circuitry."],
  },
  {
    title: "Two Minds Sharing One Idea",
    category: "portrait",
    tags: ["intelligence", "cognitive", "portrait", "mystic"],
    concept:
      "Two heads in profile facing each other, and the space between them is not empty — it holds a third form, unfinished, neither of them holding it. They are thinking it into existence between them.",
    tension:
      "The third form must be *incomplete*, as if the act of looking at each other is only halfway through building it.",
    light: "Each face lit from the other; the shared form lit from behind both.",
    palette: [
      "two skin tones in shadow",
      "the third form in cold luminous white",
      "deep neutral ground",
    ],
    composition: "Two profiles, symmetrical, the shared form on the vertical axis.",
    medium: "Oil, soft modelling, one hard accent",
    prompt:
      "Two heads in profile facing each other, an unfinished third form suspended between them. Neither is holding it.",
    scale: "Bust-length pair.",
    referenceAngle: "Profile portrait reference for nose/lip silhouettes meeting correctly.",
    pitfalls: ["Finishing the shared form."],
  },
  {
    title: "Swarm as a Single Body",
    category: "abstract",
    tags: ["intelligence", "cognitive", "mystical", "geometric"],
    concept:
      "Thousands of small dark elements that resolve, from a distance, into one coherent figure. Zoom out and it is a body; zoom in and it is nothing but decisions.",
    tension:
      "Neither reading may dominate. Pull the marks apart and it becomes an abstraction; compress them and it becomes a figure. Hold exactly on the boundary.",
    light: "The figure is darker than its ground. No light source, only value.",
    palette: ["ink black on warm grey", "one accent at the resolution point", "warm grey"],
    composition: "Figure centred, resolution only at the exact middle distance.",
    medium: "Acrylic, thousands of small strokes, stippled",
    prompt:
      "Thousands of marks that resolve into one figure only at a specific viewing distance. Swarm as single body.",
    scale: "Body-sized from across a room.",
    referenceAngle: "Squint-test your own work — that is the whole technique.",
    pitfalls: ["Letting the figure resolve too clearly."],
  },
  {
    title: "Attention as a Physical Substance",
    category: "abstract",
    tags: ["intelligence", "cognitive", "chiaroscuro", "chromatic"],
    concept:
      "Attention depicted as a real material — smoke, water, a metal — pouring from a point and pooling. The quality of the focus is the thing you can see: it thickens where it matters.",
    tension:
      "It must read as one consistent substance, not a collage of effects. Mixing metaphors loses the physics.",
    light: "Single source, but refracted through the substance.",
    palette: ["one dominant hue", "its complement in the pool", "transparent darks"],
    composition: "Diagonal pour from upper corner, pooling lower.",
    medium: "Acrylic glazes, high transparency, wet blending",
    prompt:
      "Attention as one consistent substance, pouring from a point and pooling. It thickens where it matters.",
    scale: "Close-up, macro.",
    referenceAngle: "Photograph smoke and water pours; pick one physics and stay with it.",
    pitfalls: ["Adding a second substance."],
  },
  {
    title: "Machine Considers Its Own Reflection",
    category: "portrait",
    tags: ["intelligence", "machine", "cognitive", "chrome"],
    concept:
      "A polished machine face, featureless and mirror-finished, and its reflection shows a face that is not mechanical at all. The machine is looking at itself and seeing something else.",
    tension:
      "The reflection must be soft enough to be arguable. Too clear and it states its own punchline.",
    light:
      "A single soft light for the reflection; the machine's own surface is pure reflected environment.",
    palette: ["chrome greys", "warm reflected environment", "one warm note in the reflection only"],
    composition: "Face frontally, reflection slightly off-axis so both are visible.",
    medium: "Airbrush-style glazing, extremely smooth value transitions",
    prompt:
      "A polished featureless machine face. Its reflection shows a face that is not mechanical. It does not recognise itself.",
    scale: "Head-sized, close.",
    referenceAngle:
      "Chrome reflection photography; you will need a real reflective surface to work from.",
    pitfalls: ["Reflection too legible."],
  },

  // ── MECHANICS ─────────────────────────────────────────────────────────────
  {
    title: "Orrery of a Dead God",
    category: "illustration",
    tags: ["mechanical", "clockwork", "mythic", "sacred-geometry"],
    concept:
      "A brass orrery, intricate and beautiful, where the planets are themselves small orreries, and the gear teeth are engraved with a prayer in no surviving language. It has stopped. Nothing is turning.",
    tension:
      "Show that it has stopped without drawing damage. No dust, no rust, no collapsed spring. It simply stopped, recently, for reasons of its own.",
    light: "A single warm source as from a chapel candle, deep falloff.",
    palette: ["brass and gold", "oxidised verdigris", "deep brown shadow", "one candle flame"],
    composition:
      "Three-quarter view, cropped so the mechanism continues past the frame — it is bigger than the picture.",
    medium: "Oil, fine glazing, high detail",
    prompt:
      "A brass orrery whose planets are smaller orreries, gear teeth engraved with a prayer in a dead language. Stopped.",
    scale: "Room-sized, larger than the frame.",
    referenceAngle: "Real orrery photographs and horology close-ups for tooth-count plausibility.",
    pitfalls: ["Making it broken. Stopped, not wrecked."],
  },
  {
    title: "The Escapement",
    category: "abstract",
    tags: ["mechanical", "clockwork", "geometric", "graphic"],
    concept:
      "A single extreme close-up of a clock's escapement — pallet fork, escape wheel, the fork mid-tick. Geometry as pure rhythm. The most devotional object in the room, photographed as sculpture.",
    tension:
      "It must be legible as a mechanism at the same moment it reads as sacred geometry. One of the two always wins — aim for the instant before it does.",
    light: "Hard raking light along the wheel teeth to make the geometry visible.",
    palette: ["brass and steel", "black", "one highlight per tooth"],
    composition: "Extreme crop, the fork on the diagonal.",
    medium: "Ink and gold gouache, precise, ruled",
    prompt:
      "Extreme close-up of a clock escapement mid-tick. Geometry as rhythm. Devotional object, shot as sculpture.",
    scale: "Two centimetres across.",
    referenceAngle: "Macro horology video — the pallet fork's angular throw is the subject.",
    pitfalls: ["Too wide a crop; the teeth must dominate."],
  },
  {
    title: "Machine That Grows Its Own Parts",
    category: "abstract",
    tags: ["mechanical", "engineered", "botanical", "fractal"],
    concept:
      "A mechanism caught fabricating its next component — the new part emerging from the old one the way a bone grows across a gap. Brass, but branching. Mechanism becoming organism.",
    tension:
      "It has to remain clearly machined — every surface shows tool marks — while behaving like something that grows. Keep the tool marks, lose the machined logic.",
    light: "Hard light from within the forming joint, so growth appears to be self-lit.",
    palette: ["brass", "patina green", "black background", "hot gold at the joint"],
    composition: "Tight crop on the junction where old becomes new.",
    medium: "Oil, fine detail, luminous glazes",
    prompt:
      "A machine growing its next part, brass but branching, emerging like a bone across a gap. Machined surfaces, organic logic.",
    scale: "Held in two hands.",
    referenceAngle:
      "Study how a limb bone's growth plate looks; that is the reference, not a machine part.",
    pitfalls: ["Dropping the tool marks and becoming a plant."],
  },
  {
    title: "Piston Room",
    category: "landscape",
    tags: ["mechanical", "industrial", "cathedral", "monochrome"],
    concept:
      "An interior of a hall filled with a grid of vertical pistons, each at a different height, all frozen mid-stroke. It reads as a forest of columns, or a city seen from below.",
    tension:
      "Keep every piston visibly *identical*. One that differs turns the room into an object study instead of a space.",
    light:
      "Even top light through a high opening, raking enough to throw a shadow from each piston.",
    palette: ["oiled steel greys", "soot", "one shaft of warm light", "cold overall"],
    composition: "One-point perspective, grid receding, top light repeating.",
    medium: "Acrylic, layered greys, hard-edged shadow",
    prompt:
      "A hall of identical vertical pistons frozen mid-stroke at different heights. A forest of columns.",
    scale: "Cathedral-sized hall.",
    referenceAngle: "Engine halls for genuine repetition and scale.",
    pitfalls: ["Varying the pistons."],
  },
  {
    title: "Spring That Stores an Entire Landscape",
    category: "still-life",
    tags: ["mechanical", "engineered", "landscape", "alchemical"],
    concept:
      "A single large coil spring, and inside the coil, wound inside it, is a complete landscape — a horizon, weather, distance. Coiled up and stored. The whole world under tension.",
    tension:
      "The inner landscape must be genuinely miniature and genuinely complete, so unwinding it feels like a promise rather than a trick.",
    light:
      "Single warm source grazing the coil so the inner scene alternates in and out of visibility.",
    palette: ["steel", "inner landscape in full colour", "warm raking light"],
    composition: "Extreme close-up, coil filling frame, landscape visible in the gaps.",
    medium: "Oil, very fine detail in the inner scene, loose on the steel",
    prompt:
      "A large coil spring with a complete landscape wound inside it. Coiled up, stored. Unwinding it is a promise.",
    scale: "Spring a foot across.",
    referenceAngle: "Macro of real coil springs; the gap rhythm sets the reveal.",
    pitfalls: ["Inner landscape too vague to be a whole place."],
  },
  {
    title: "Clock That Counts Down to Its Own Repair",
    category: "still-life",
    tags: ["mechanical", "clockwork", "time", "mystic"],
    concept:
      "An open-cased wall clock, its own parts laid out in front of it on the bench in the exact order they will be needed — someone is about to repair it. The mechanism is whole but empty of its future.",
    tension:
      "The layout must imply a person who knows the job intimately. Order, not scatter. Chaos would read as breakdown, not as expertise.",
    light: "Workbench side-light, warm, low.",
    palette: ["walnut case", "brass", "steel", "shadow"],
    composition: "Flat-lay bench, clock case at back, parts laid in a line forward.",
    medium: "Oil on panel, detail, warm mid-tones",
    prompt:
      "An open clock case with its future parts laid out in order on the bench. Someone is about to repair it.",
    scale: "Mantel clock and small parts.",
    referenceAngle: "Horological assembly diagrams for correct part order.",
    pitfalls: ["Loose scatter reading as decay."],
  },
  {
    title: "Flywheel at Terminal Velocity",
    category: "abstract",
    tags: ["mechanical", "chiaroscuro", "engineered", "atmospheric"],
    concept:
      "A single flywheel still turning, photographed with a long exposure so the spokes dissolve into a continuous disc while the rim stays sharp. The mechanics of speed, made visible as blur.",
    tension:
      "Rim sharp, spokes gone. Any sharpness in the spokes kills the entire effect — it has to be exactly at the edge of legibility.",
    light: "Hard rim highlight; the blurred interior picks up ambient colour from the room.",
    palette: ["rim highlight", "motion-blur disc in a contrasting hue", "dark surround"],
    composition: "Dead-centre disc, filling frame, no context.",
    medium:
      "Airbrush-style soft gradient with a hard rim, or painted from a long-exposure reference",
    prompt:
      "A flywheel photographed so the rim is sharp and the spokes dissolve into a disc. Speed made visible as blur.",
    scale: "Close-up.",
    referenceAngle:
      "Photograph a spinning wheel with a slow shutter on a tripod — do it, it's easy.",
    pitfalls: ["Spokes too visible."],
  },
  {
    title: "Machine That Only Runs When Observed",
    category: "figurative",
    tags: ["mechanical", "cognitive", "mystic", "clockwork"],
    concept:
      "A complex mechanism mid-operation, and one worker's attention is clearly load-bearing for it — the machine's motion and the worker's gaze are visibly the same circuit. Looking away would stop it.",
    tension:
      "Show the connection without diagramming it. No arrows, no lines. The gaze and the motion just have to rhyme.",
    light: "Focused pool of light on both faces and the mechanism; everything else falls away.",
    palette: ["brass", "skin in shadow", "one warm pool of light", "dark surround"],
    composition: "Worker and machine sharing a single pool of light, nothing else visible.",
    medium: "Oil, dramatic single source",
    prompt:
      "A worker and a mechanism in one pool of light, gaze and motion rhyming. The machine runs only while observed.",
    scale: "Human and machine-sized.",
    referenceAngle: "Caravaggio lighting; the shared light pool is the composition.",
    pitfalls: ["Diagramming the connection."],
  },

  // ── CROSS-PILLAR: her stated aesthetic applied to the pillars ──────────────
  {
    title: "Moth Wing Constellation",
    category: "abstract",
    tags: ["astronomic", "mystic", "bioluminescent", "negative-space"],
    concept:
      "A moth's wing and a star chart, and they are the same diagram. Wing markings resolve into named constellations; the stars resolve into wing markings.",
    tension:
      "Both readings must be equally available. Bias either way and it becomes a pun with a single meaning.",
    light: "Dark field; the markings are the only light source.",
    palette: ["ink black", "constellation cyan-white", "dust ochre", "one warm star"],
    composition: "One wing, symmetrical, filling frame — chart margins just visible.",
    medium: "Ink, gouache, luminous glazes",
    prompt:
      "A moth wing and a star chart as the same diagram. Wing markings are constellations, stars are markings.",
    scale: "One wing, life size.",
    referenceAngle: "Real lepidoptera wing plates; and an antique star atlas for the chart style.",
    pitfalls: ["Making the mapping literal and legible."],
  },
  {
    title: "Esoteric Garden Gate of Open Mechanisms",
    category: "landscape",
    tags: ["mechanical", "clockwork", "esoteric", "flora"],
    concept:
      "A garden gate whose every hinge, latch and bar is a working mechanism, arranged so the whole gate opens into a pattern that only reads as a sigil from directly in front.",
    tension:
      "The sigil must be readable from one specific spot. It should look like decoration from every other angle — the viewer has to find the viewpoint.",
    light: "Late sun through the gate, casting the mechanism's shadow as the sigil.",
    palette: ["verdigris", "rust", "green", "shadow-sigil in warm ochre"],
    composition: "Strict frontal symmetry, viewer's eye at the exact sigil axis.",
    medium: "Acrylic, detailed, warm raking light",
    prompt:
      "A garden gate of working mechanisms whose shadow forms a sigil, readable only head-on.",
    scale: "Life-size gate.",
    referenceAngle: "Cast a real object's shadow three times; the shadow is a separate drawing.",
    pitfalls: ["Shadow not actually forming the shape — test it by casting it."],
  },
  {
    title: "Astronomer's Workshop, Engine Left Running",
    category: "still-life",
    tags: ["astronomic", "mechanical", "mystic", "night"],
    concept:
      "An astronomer's instrument table: brass calculating machine, star charts, a lamp. The calculating machine is mid-computation — its carry digits caught mid-swing. She stepped away for one minute.",
    tension:
      "The presence has to be implied by absence of use — a warm cup, a chair still warm, a sleeve impression. Nobody in the picture, everybody in the room.",
    light: "Single lamp, warm, everything beyond the table in darkness.",
    palette: ["brass", "chart paper", "lamp gold", "dark green-black surround"],
    composition: "Table-level horizontal, objects along the front edge, dark above.",
    medium: "Oil, deep shadow, single warm source",
    prompt:
      "An astronomer's instrument table mid-computation. Brass calculating machine, lamp, star charts. She stepped out for a minute.",
    scale: "Table-top.",
    referenceAngle: "Planetarium and historical instrument collections.",
    pitfalls: ["Too many objects; keep the front edge sparse."],
  },
  {
    title: "Initiation of the Machine",
    category: "figurative",
    tags: ["machine", "ritual", "mystic", "sacred-geometry"],
    concept:
      "A figure kneeling before a dormant machine in a cathedral-scale workshop, at the exact moment power reaches it. The machine is not switching on — it is being *permitted*.",
    tension:
      "Keep the human gesture small and the machine enormous. The power dynamic is the subject, and it is not symmetrical.",
    light:
      "A single line of light travelling along the machine's frame, arriving at the point of contact.",
    palette: ["stone grey", "brass", "the light line in white", "deep shadow"],
    composition: "Figure small and low, machine towering, the light line the only diagonal.",
    medium: "Acrylic, atmospheric, hard single accent",
    prompt:
      "A figure kneeling before a dormant cathedral-scale machine at the moment power reaches it. Not switching on — being permitted.",
    scale: "Machine four times human height.",
    referenceAngle: "Scale figures in cathedral photography for the power relationship.",
    pitfalls: ["Equal size — kills the dynamic entirely."],
  },
  {
    title: "Symmetry of the Unseen",
    category: "abstract",
    tags: ["sacred-geometry", "geometric", "mystic", "chromatic"],
    concept:
      "A mandala built by the rule 'every element is reflected across two axes and then broken by one'. The symmetry is absolute except in a single quadrant, where it fractures into organic growth.",
    tension:
      "One broken quadrant only. Two read as damage; one reads as intent — the single point where the pattern chose.",
    light: "Flat, emblematic, no atmosphere.",
    palette: ["two flat colours", "the broken quadrant in a third colour", "ground"],
    composition: "Perfectly centred, the break at one consistent clock position.",
    medium: "Acrylic on panel, flat, hard edges",
    prompt:
      "A mandala of absolute two-axis symmetry broken in exactly one quadrant, where the pattern becomes organic.",
    scale: "One panel.",
    referenceAngle: "Hilma af Klint's group work for the flat chromatic geometry.",
    pitfalls: ["Breaking more than one quadrant."],
  },
  {
    title: "Bioluminescent Server Grove",
    category: "landscape",
    tags: ["machine", "botanical", "nocturnal", "fractal"],
    concept:
      "A data centre in a cave, the racks overgrown with bioluminescent fungus that has followed the cabling exactly — the light traces the wiring diagram. The building and the mycelium are one system.",
    tension:
      "The fungus must genuinely follow the cable paths, not just be scattered nearby. Draw the network and let the organism obey it.",
    light: "Entirely bioluminescent; no fixtures lit, no daylight.",
    palette: ["cyan-green glow", "wet stone grey", "rust orange", "black depth"],
    composition: "One-point perspective down a rack aisle, the light leading the eye.",
    medium: "Acrylic, luminous glazing over dark ground",
    prompt:
      "A data centre overgrown with bioluminescent fungus tracing the cabling. Building and mycelium as one system.",
    scale: "Aisle-sized, deep.",
    referenceAngle:
      "Server-aisle photos for perspective; fungal bioluminescence photos for the glow behaviour.",
    pitfalls: ["Fungus not following the cable routes."],
  },
  {
    title: "Votive Machine",
    category: "still-life",
    tags: ["mechanical", "ritual", "sacred-geometry", "alchemical"],
    concept:
      "A small brass mechanism on a private altar, surrounded by offerings and candle stubs — a functioning piece of engineering that is also a devotional object. Both readings are fully true.",
    tension:
      "Make the engineering legible (real jewel bearings, real tolerances) so the devotion reads as chosen rather than as naive.",
    light: "Candlelight only, low, flickering — paint the flame's effect, not the candle.",
    palette: ["brass", "wax", "dark wood", "warm flame"],
    composition: "Centre, symmetrical, close, small scale, intimate.",
    medium: "Oil, dark ground, single candle source",
    prompt:
      "A small brass mechanism on a private altar among offerings and candle stubs. Real tolerances, real devotion.",
    scale: "Fifteen centimetres across.",
    referenceAngle: "Horological movement photographs for the engineering accuracy.",
    pitfalls: ["Making the mechanism crude; the precision is what makes it sacred."],
  },
  {
    title: "Blueprint of a Language Built From Load-Bearing Walls",
    category: "illustration",
    tags: ["blueprint", "architectural", "cognitive", "engineered"],
    concept:
      "An architectural drawing in which every structural element is also a letter, and the building spells something. Load-bearing walls are the letters that can carry load; the others are drawn as unsupported, which is why they are smaller.",
    tension:
      "The sentence must be readable and the structure must still be valid — the unsupported letters have to be genuinely non-essential, which constrains what you can write.",
    light: "Flat, technical, printed.",
    palette: ["prussian blue", "white", "the load path in one accent"],
    composition: "Elevation, lettering integrated into the structure, not annotated beside it.",
    medium: "Ink and technical pen, ruled",
    prompt:
      "An architectural drawing where the structure spells something. Load-bearing walls are the letters that can carry weight.",
    scale: "One elevation.",
    referenceAngle:
      "Structural lettering on real shop drawings; the load-bearing letters need real spans.",
    pitfalls: ["Cheating the structural logic to fit the sentence."],
  },
  {
    title: "Ethereal Engine Room",
    category: "landscape",
    tags: ["engineered", "ethereal", "atmospheric", "nocturnal"],
    concept:
      "An engine room rendered weightless — the machinery is exactly right but the room has lost its gravity. Everything hangs slightly wrong, and the light behaves like it is underwater.",
    tension:
      "Technical accuracy must survive, or it becomes a dream illustration. Every pipe and fitting real; only the physics of weight betrayed.",
    light: "Volumetric, suspended, catching drifting dust as if the air were liquid.",
    palette: ["pale steel", "warm sodium lamp", "volumetric blue-grey", "deep shadow"],
    composition: "Looking up into the machinery; pipes converging above.",
    medium: "Acrylic, soft focus, glazed atmospheric depth",
    prompt:
      "A perfectly accurate engine room with weightless physics. Real fittings, no gravity, light like water.",
    scale: "Room-sized.",
    referenceAngle: "Ship engine rooms for spatial accuracy.",
    pitfalls: ["Losing technical accuracy in the softness."],
  },
  {
    title: "The Designer's Own Tools, Retired",
    category: "still-life",
    tags: ["design", "memory", "decay", "geometric"],
    concept:
      "A retired designer's tools laid out in a single row: three technical pens, a scale rule, a worn triangle. Each worn exactly where that person's hand habit wore it. Their hands are perfectly legible in the wear pattern.",
    tension:
      "The wear is the portrait. Every mark must be in a plausible place for a right- or left-handed grip — an implausible wear pattern breaks it instantly.",
    light: "Soft north light, museum flat.",
    palette: ["brass", "black plastic", "fingerprint-worn shine", "dusty grey"],
    composition: "Flat-lay, single row, evenly spaced, generous margins.",
    medium: "Watercolour and gouache, careful, warm paper",
    prompt:
      "A retired designer's worn tools in one row. The wear pattern makes a portrait of their hands.",
    scale: "30cm across.",
    referenceAngle:
      "Photograph your own tools for honest wear patterns — nobody should guess where a hand goes.",
    pitfalls: ["Uniform wear. Real wear is uneven and hand-specific."],
  },
  {
    title: "Machine Learning to Heal Itself",
    category: "abstract",
    tags: ["machine", "development", "fractal", "bioluminescent"],
    concept:
      "A machine repairing its own fracture, and the repair is a growing structure that fills the gap the way coral or bone would — organic inside mechanical. The damage becomes the growth.",
    tension:
      "The growth must respect tolerances it could not have before — it has to be structurally *better* than the part it replaces, not merely different.",
    light: "Bioluminescent growth as the light source, cold against dark machine.",
    palette: ["dark steel", "luminous cyan", "one warm machine warning colour", "black"],
    composition: "Extreme close-up on the fracture line, diagonal.",
    medium: "Acrylic with luminous glazing, detailed",
    prompt:
      "A machine repairing its own fracture with organic growth, structurally better than the original part. The damage becomes the growth.",
    scale: "Held in one hand.",
    referenceAngle: "Bone callus photographs; that is the mechanism you are depicting.",
    pitfalls: ["Growth that is prettier but weaker."],
  },
  {
    title: "Architectural Memory Palace",
    category: "landscape",
    tags: ["architectural", "cognitive", "memory", "esoteric"],
    concept:
      "A building whose rooms are memories — you enter the hall and recognise your grandmother's kitchen at impossible scale, the corridor as a school, the stairs going up into a year you cannot name.",
    tension:
      "Only one or two rooms may be legible as specific places. Three and it becomes a list; two reads as memory, which is how memory actually works.",
    light:
      "Each room lit by its own remembered light — different colour temperature per room, no global source.",
    palette: [
      "warm kitchen ochre",
      "school-institutional green",
      "cold unnamed grey",
      "dark connecting stair",
    ],
    composition:
      "One-point interior view through three rooms, each a different era of light, stair rising out of frame.",
    medium: "Acrylic, atmospheric, interior perspective",
    prompt:
      "A building whose rooms are memories. Two rooms legible as specific places, one unnamed. Each lit by its own remembered light.",
    scale: "Domestic-scale, but the rooms don't agree with each other.",
    referenceAngle: "Specific, not generic interiors — borrow the light, not the layout.",
    pitfalls: ["More than two legible rooms."],
  },
  {
    title: "The Escapement of an Unheard Sound",
    category: "abstract",
    tags: ["mechanical", "cognitive", "monochrome", "graphic"],
    concept:
      "A mechanism built to keep exact time, but for a rhythm no instrument plays. Its escapement beats in a pattern that is precise, mechanical, and completely unheard — a clock keeping time for something inaudible.",
    tension:
      "It must be mechanically convincing while being musically meaningless. Any visible relationship to real rhythm ruins it.",
    light: "Hard, even, catalogue lighting — this is documentation of an object.",
    palette: ["steel and brass", "black ground", "one highlight per beat"],
    composition: "Orthographic side elevation, elevation-drawing flatness.",
    medium: "Ink and graphite, technical, ruled",
    prompt:
      "A clock keeping exact time for a rhythm no instrument plays. Escapement in an unheard pattern. Orthographic.",
    scale: "Specimen-plate scale.",
    referenceAngle: "Orthographic projection rules — the flatness is the point.",
    pitfalls: ["The pattern resolving into a recognisable rhythm."],
  },
  {
    title: "Assembly as Ceremony",
    category: "figurative",
    tags: ["engineering", "ritual", "geometric", "sacred-geometry"],
    concept:
      "Two figures assembling a mechanism, and the assembly has the geometry and pacing of a ritual — mirrored, repeated, precisely choreographed, each motion mirroring the other's across the part being joined.",
    tension:
      "The mirroring must be exact. If one figure moves first, it becomes two people working; if they move in perfect symmetry, it becomes a rite.",
    light: "Overhead, centred, theatrical — a single hanging source.",
    palette: ["workwear greys", "brass", "sweat of labour", "dark floor"],
    composition: "Perfect bilateral symmetry around the central part being joined.",
    medium: "Oil, symmetrical, hard single source",
    prompt:
      "Two figures assembling a mechanism with ritual exactness, mirrored across the part being joined. Ceremony, not labour.",
    scale: "Two figures, one part.",
    referenceAngle: "Symmetry reference for two-figure mirrored poses.",
    pitfalls: ["One figure leading — that breaks the rite."],
  },
  {
    title: "Nightshift at the Astronomical Foundry",
    category: "landscape",
    tags: ["astronomic", "industrial", "nocturnal", "alchemical"],
    concept:
      "A foundry that casts metal into the shapes of constellations — molten brass poured into star-pattern moulds, cooling into actual star maps. The furnace is the light source.",
    tension:
      "The castings must be recognisably *objects made by casting* — sprues, parting lines, shrinkage — while remaining unmistakably constellations. Manufactured celestial.",
    light:
      "Furnace glow from below, orange, plus one cold blue star-field visible through the roof opening.",
    palette: ["molten orange", "cooling brass", "cold star blue", "soot"],
    composition: "Low, looking up past the moulds to the open roof and stars.",
    medium: "Acrylic, hot/cold contrast, glowing glazes",
    prompt:
      "A foundry casting metal into constellation shapes. Molten brass into star-pattern moulds. Furnace glow from below, stars above.",
    scale: "Industrial hall.",
    referenceAngle: "Foundry pour photographs for the light behaviour of molten metal.",
    pitfalls: ["Losing the casting artefacts; sprues and parting lines are what sell it."],
  },
  {
    title: "Blueprint of a Machine That Cannot Exist",
    category: "illustration",
    tags: ["blueprint", "engineered", "esoteric", "graphic"],
    concept:
      "A complete, confident engineering drawing of a mechanism with no possible function — every part is drawn to real tolerances, the assembly order is correct, and the whole thing accomplishes nothing.",
    tension:
      "The drawing's competence must be total. Any hedging in the linework turns absurdity into a joke; total confidence makes it quietly unnerving.",
    light: "Flat, printed, no atmosphere whatsoever.",
    palette: ["prussian blue", "white", "one dimension line in red"],
    composition:
      "Three orthographic views plus an isometric — proper drafting layout, properly labelled, nothing wrong anywhere.",
    medium: "Technical pen, ruler, on drafting film",
    prompt:
      "A confident engineering drawing of a mechanism with no possible function. Perfect tolerances, correct assembly order, accomplishes nothing.",
    scale: "Drafting sheet, A1.",
    referenceAngle: "Real machine general-arrangement drawings; copy the layout rules exactly.",
    pitfalls: ["Line quality that looks hand-wavy."],
  },
  {
    title: "The Designer's Doubt",
    category: "abstract",
    tags: ["design", "cognitive", "negative-space", "monochrome"],
    concept:
      "A grid of design variants — twenty solutions to one brief — and one of them is empty. Not drawn. The empty cell is the one she kept, and it is exactly the right size.",
    tension:
      "The empty cell must be placed by compositional logic, not conspicuously. If it sits dead centre it reads as a statement; placed off-centre it reads as a decision.",
    light: "Flat, even, like a photographed layout.",
    palette: ["graphite variants on paper", "the empty cell as pure white", "one ruled border"],
    composition: "Regular grid, the empty cell in the lower-left third.",
    medium: "Pencil on paper, no colour",
    prompt:
      "Twenty design variants on one brief, one cell deliberately empty. The empty one is the right size and sits off-centre.",
    scale: "One sheet.",
    referenceAngle: "Real variation-series layouts; the grid discipline does the work.",
    pitfalls: ["Centring the empty cell."],
  },
];
