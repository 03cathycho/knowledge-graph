# Calculus Knowledge Graph

> A pedagogically structured knowledge graph of mathematical concepts, powering a Socratic AI tutor that guides students without giving them the answer.

**Author:** Catherine Cho '27 · Dartmouth College
**Faculty mentors:** Prof. Soroush Vosoughi (Computer Science), Prof. Peter Mucha (Mathematics)
**Funding:** Hanlon / Coulter Scholars Program

---

## What this is

This project builds and uses a **knowledge graph** of mathematical concepts — a network where each node is a concept (e.g., "Chain Rule") and each edge encodes a meaningful pedagogical relationship (prerequisite, related, uses). Unlike a standard concordance or co-occurrence graph, every edge here represents a *why*: a specific reason one concept depends on or relates to another.

On top of that graph, this repo includes a **Socratic calculus tutor** — a chat interface that, given a student's question, retrieves the relevant concept and its surrounding context from the graph, then uses an LLM (Claude) to generate guidance that nudges the student toward their own answer rather than solving the problem for them.

The graph currently covers all three volumes of OpenStax Calculus (~880 concepts, ~1,200 edges). The methodology is designed to extend to any mathematical domain and any pedagogical tradition.

## Why it matters

Math education is fundamentally cumulative — most confusion stems not from the topic at hand but from an unmastered prerequisite. Existing AI tutors solve problems on demand, which can short-circuit the learning process. This project explores an alternative: a tutor whose answers are *grounded* in an explicit knowledge graph, so that every hint is tied to a specific prerequisite the student likely needs to revisit.

The longer-term research questions, to be developed across the Hanlon/Coulter program:

1. How do we construct a formal knowledge graph of mathematical concepts that is both machine-interpretable and pedagogically meaningful?
2. Can such a graph support useful downstream applications in personalized tutoring, curriculum design, and AI reasoning?
3. How do cross-cultural curricula (e.g., U.S. vs. Korean math education) differ in their implicit concept orderings, and what does that comparison reveal?

## Repo structure

```
calculus-knowledge-graph/
├── README.md                          ← you are here
├── notebooks/
│   ├── 01_wikipedia_crawler.ipynb     ← initial experiment: crawling Wikipedia for math concepts
│   ├── 02_calculus_kg_manual.ipynb    ← hand-curated graph for OpenStax Vol 1
│   ├── 03_calculus_kg_full.ipynb      ← LLM-assisted graph for all 3 volumes (final)
│   └── 04_edge_discovery.ipynb        ← uses Claude API to propose additional edges
├── data/
│   ├── all_calculus_graph.json        ← the final knowledge graph (882 nodes, 1225 edges)
│   ├── all_calculus_nodes.csv         ← nodes only, for Cosmograph/Gephi
│   └── all_calculus_edges.csv         ← edges only, for Cosmograph/Gephi
├── app/
│   └── calculus_tutor.jsx             ← React-based Socratic tutor
├── docs/
│   ├── methodology.md                 ← how the graph was constructed
│   └── ontology.md                    ← what nodes/edges mean
└── .gitignore
```

## Quick start

### Explore the graph visually

The fastest way to see the graph is via [Cosmograph](https://cosmograph.app/run/):

1. Open [cosmograph.app/run](https://cosmograph.app/run/)
2. Drag `data/all_calculus_nodes.csv` onto "Graph Metadata"
3. Drag `data/all_calculus_edges.csv` onto "Graph Data"

For deeper analysis (community detection, centrality measures, etc.), use [Gephi](https://gephi.org) with the same CSVs.

### Run the tutor

Open `app/calculus_tutor.jsx` as a Claude artifact (or adapt for any React environment with Anthropic API access). On first run, drag `data/all_calculus_graph.json` into the upload area. From then on, the graph is stored locally and you can ask questions like:

- *"I'm stuck on the chain rule"*
- *"How do I find the volume of a rotated solid?"*
- *"When do I use L'Hôpital's rule?"*

The tutor will identify the relevant concept, retrieve its prerequisites and related ideas from the graph, and respond with Socratic guidance — not the solution.

### Regenerate the graph from scratch

If you want to extend the graph to other textbooks or modify the concept ontology:

1. Open `notebooks/03_calculus_kg_full.ipynb`
2. Set your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
3. Edit the `TEXTBOOK` dictionary to point to your sections
4. Run all cells

The notebook persists progress after every section, so it's safe to interrupt and resume. Generating the full graph costs roughly $3–6 in API usage and takes 15–25 minutes.

## How it works

### The graph

Each concept node has:
- `description` — one-sentence definition
- `hint` — actionable one-liner for a stuck student
- `difficulty` (1–5)
- `volume`, `chapter`, `section` — provenance from the source textbook

Each edge has a `type`:
- **`prerequisite`** — A is required to understand B (forms a directed acyclic graph)
- **`uses`** — B applies A as a tool, but A isn't strictly required
- **`related_to`** — analogous, inverse, or commonly confused concepts

For details, see [docs/ontology.md](docs/ontology.md).

### The tutor (RAG architecture)

Each student question goes through two LLM calls:

1. **Routing** — Claude is given the question and the list of ~880 concept names, and asked to pick the most relevant match.
2. **Guidance** — Claude is then given the matched concept's description, hint, prerequisites, and related concepts, and asked to produce Socratic guidance.

The knowledge graph is the source of grounding. Without it, an LLM would just solve the problem; with it, the LLM is forced to anchor its hints in specific prerequisites and related ideas — which is exactly what a good human tutor does.

For details, see [docs/methodology.md](docs/methodology.md).

## What's next

This repo is the first phase of a two-year project. Planned extensions:

- **Cross-cultural curriculum overlay** — Korean textbook ordering as parallel prerequisite signal (Winterim 2025–26 fieldwork)
- **Back-reference parsing** — extract "recall from Section 2.3" prerequisite signals automatically from OpenStax HTML
- **Problem-type nodes** — link homework problems to required concepts
- **User testing** — pilot the tutor with Dartmouth students and TAs

## Acknowledgments

This work is funded by the Hanlon Scholars and Coulter Scholars Programs at Dartmouth College.

Special thanks to Professors Soroush Vosoughi and Peter Mucha for their mentorship, and to the OpenStax team for making high-quality educational content freely available.

## License

MIT — see [LICENSE](LICENSE).
