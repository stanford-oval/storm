# Knowledge Curation & Memory Failure Modes

This document catalogues common failure modes encountered in knowledge curation
and long-term memory within retrieval-augmented systems like STORM. Use it when
designing experiments, debugging unexpected output, or filing issues.

Addresses [#409](https://github.com/stanford-oval/storm/issues/409).

---

## 1. Failure Modes

### 1.1 Duplication & Inconsistency

| | Detail |
|---|---|
| **What happens** | The same fact appears in multiple knowledge entries with slightly different wording, or two entries directly contradict each other. |
| **Symptoms** | Generated articles repeat points; conflicting claims appear in different sections; outline topics overlap heavily. |
| **Likely causes** | Multiple retrieval passes returning overlapping sources; no deduplication step after information gathering; sources that genuinely disagree without the system resolving the conflict. |
| **Diagnostics** | Inspect the curated knowledge store for near-duplicate entries (cosine similarity > 0.9). Compare claims across sections and flag logical contradictions. Check whether the conversation-simulation stage asked the same question in different forms. |

### 1.2 Drift as Memory Grows

| | Detail |
|---|---|
| **What happens** | As the accumulated knowledge base expands over successive runs, the system's focus shifts away from the original query intent or topic scope. |
| **Symptoms** | Later-generated content drifts off-topic; retrieved context becomes less relevant; article quality degrades on longer or multi-session runs. |
| **Likely causes** | Retrieval index grows without pruning, so older or tangential entries dilute relevance; embedding space becomes crowded, reducing nearest-neighbor precision; no mechanism to re-anchor on the original query. |
| **Diagnostics** | Track retrieval-relevance scores over successive iterations. Measure topic coherence (e.g., average pairwise similarity of retrieved chunks to the original query). Compare output quality metrics between early and late runs. |

### 1.3 Forgetting Important Constraints

| | Detail |
|---|---|
| **What happens** | Critical user-specified constraints, domain rules, or earlier findings are dropped from context during generation. |
| **Symptoms** | Output ignores stated scope limits; previously established facts are contradicted in later sections; safety or formatting constraints are violated partway through a long article. |
| **Likely causes** | Fixed context window forces eviction of earlier instructions; retrieval fails to surface the constraint because it was stored as metadata rather than searchable content; the constraint was never persisted to the knowledge store in the first place. |
| **Diagnostics** | Verify that constraints are present in the knowledge store (not only in the initial prompt). Check whether the retrieval step returns constraint-bearing entries when they are relevant. Inspect the final assembled prompt to confirm constraints were included. |

---

## 2. Quick-Reference Diagnostic Table

| Failure Mode | First Thing to Check | Tool / Technique |
|---|---|---|
| Duplication | Near-duplicate entries in knowledge store | Embedding similarity search, exact-match hashing |
| Inconsistency | Contradicting claims across entries | Pairwise claim comparison, NLI model |
| Drift | Relevance scores declining over iterations | Query-to-chunk similarity trend plot |
| Forgotten constraints | Constraint presence in retrieval results | Keyword search in knowledge store; prompt inspection |

---

## 3. Experiment Design & Issue-Reporting Checklist

Use this checklist before running experiments or when reporting a knowledge/memory issue.

### Before running

- [ ] Define the expected scope and key constraints in writing.
- [ ] Decide on a maximum knowledge-store size or iteration count.
- [ ] Set up logging for retrieval scores and knowledge-store snapshots.
- [ ] Establish a baseline: run a short, single-pass version first.

### During the run

- [ ] Monitor retrieval-relevance scores for downward trends.
- [ ] Spot-check curated entries for duplicates or contradictions.
- [ ] Verify that constraints still appear in assembled prompts.

### When reporting an issue

- [ ] State the STORM version and configuration used.
- [ ] Describe the query or topic and any constraints provided.
- [ ] Include the number of retrieval/curation iterations run.
- [ ] Attach or summarize the knowledge-store contents (or a representative sample).
- [ ] Note which failure mode(s) from this document you observed.
- [ ] Provide the relevant log output (retrieval scores, prompts, generated text).

---

## Further Reading

- [STORM README](../README.md) -- system overview and quickstart.
- [CONTRIBUTING.md](../CONTRIBUTING.md) -- how to contribute fixes or improvements.
