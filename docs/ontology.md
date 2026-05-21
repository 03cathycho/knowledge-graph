# Ontology

This document defines what counts as a node and what counts as an edge in the knowledge graph. The ontology is the load-bearing design decision in the whole project — it determines whether the graph can support meaningful downstream tasks.

## Nodes: concepts

A **concept** is a specific, learnable idea within a calculus textbook section. The granularity is tuned so that a stuck student would identify with one concept at a time, not an entire chapter.

### What counts as a concept

| Yes | No |
|---|---|
| "Chain Rule" | "Differentiation" (too broad) |
| "U-Substitution" | "Integration Techniques" (too broad) |
| "L'Hôpital's Rule" | "Limits" (too broad) |
| "Disk Method" | "Solids of Revolution" (this is a *topic*, not a concept) |
| "Pythagorean Identity" | "Trig" (too broad) |

A useful heuristic: a concept is something a student could plausibly say "I don't understand X" about. "I don't understand the chain rule" is well-formed; "I don't understand differentiation" is too vague to act on.

### Concept attributes

Every concept has:

- `name` — short, specific (3–6 words)
- `description` — one sentence definition
- `hint` — one *actionable* sentence telling a stuck student what to think about
- `difficulty` — integer 1–5
- `volume`, `chapter`, `section` — provenance from OpenStax

The `hint` field is the unique pedagogical contribution. A good hint is not a definition; it's an operational nudge. Compare:

| Bad hint (definitional) | Good hint (operational) |
|---|---|
| "The chain rule differentiates compositions" | "Differentiate the outer function, keep the inner unchanged, then multiply by the derivative of the inner" |
| "U-sub reverses the chain rule" | "Find a function AND its derivative in the integrand — those are your u and du" |
| "L'Hopital handles indeterminate forms" | "Only for 0/0 or ∞/∞ — check first by plugging in!" |

## Edges: typed relationships

There are exactly **three edge types**. Adding more was tempting but creates ambiguity at annotation time. These three cover the pedagogically meaningful cases:

### `prerequisite`

**Meaning:** A → B means a student must understand A before they can meaningfully understand B.

**Test:** "Could a student reasonably learn B without first learning A?" If no, it's a prerequisite. If yes (but A is still useful), it's `uses`.

**Example:** `Chain Rule → Implicit Differentiation`. You can't do implicit differentiation without already being fluent in the chain rule — every step uses it.

**DAG property:** The subgraph of prerequisite edges must be acyclic. A cycle would mean A requires B requires A, which is logically impossible. The construction pipeline validates this.

### `uses`

**Meaning:** B applies A as a tool, but a student could be introduced to B without first mastering A.

**Test:** "Is A actively used in B's derivation or application, but a textbook could plausibly present B before A?"

**Example:** `Squeeze Theorem → Derivative of Sine`. The proof of `d/dx[sin x] = cos x` uses the squeeze theorem to show `lim_{h→0} sin(h)/h = 1`. But the derivative rule can be taught as a fact without dwelling on the squeeze theorem proof.

### `related_to`

**Meaning:** Two concepts are analogous, inverse operations, or commonly confused. The relationship is symmetric.

**Test:** "If a student is stuck on one, would thinking about the other help spark insight?"

**Example:** `Chain Rule ↔ U-Substitution`. They're inverse operations; understanding one illuminates the other. These are the most pedagogically powerful edges — they're the "fire the neurons" connections that good tutors make.

## What's deliberately NOT in the ontology

Several relationships were considered and rejected:

- **"Is-a" / hierarchical containment.** It's tempting to encode "Power Rule is a kind of Differentiation Rule." But this creates many uninteresting edges (every concept has parents in the topic taxonomy) and the same information is captured better by the `chapter`/`section` metadata fields.

- **"Co-occurs with."** This is what the Wikipedia graph produced. Without a *reason*, co-occurrence is just statistical noise.

- **"Conflicts with."** Hard to define rigorously and rarely actionable for a student. May be revisited later for handling common misconceptions (e.g., students applying the power rule to `x^x`).

- **Weighted edges.** Every edge is currently binary. Weighting (e.g., "strong vs. loose prerequisite") is a planned extension but not yet implemented; doing it well requires either expert annotation or a learned model trained on student response data.

## Granularity tension

There's an unresolved tradeoff between specificity and graph size:

- **Too coarse:** "Integration" — useless for a stuck student
- **Too fine:** "Integrating x² from 0 to 1" — there's a concept like this for every possible integrand, which is infinite

The current ontology lands at roughly the granularity of named techniques and named theorems. This produces 5–10 concepts per textbook section, which is the sweet spot for a tutoring application: small enough that the graph stays navigable, large enough to capture the actual ideas students get stuck on.

This is a design choice, not a discovered fact. Future work should test whether shifting the granularity (e.g., adding a sub-concept layer for sub-skills within each named technique) improves tutoring outcomes.
