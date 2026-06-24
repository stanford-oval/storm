# STORM Knowledge Curation and Memory Failure Modes

This guide summarizes common failure modes when STORM-style agents curate long-term knowledge bases. It is intended for practitioners designing experiments, debugging runs, or reporting issues.

## Why this matters

STORM pipelines combine retrieval, conversation simulation, outline generation, and article synthesis. As curated memory grows, failures can be subtle: answers may look plausible while the underlying knowledge store becomes inconsistent or stale.

## Failure modes

### Duplication and inconsistency

**Symptoms**

- Multiple entries describe the same fact with conflicting wording or dates
- Retrieval returns several near-duplicate snippets for one query
- Generated articles repeat the same point with incompatible details

**Likely causes**

- Re-ingesting sources without deduplication
- Summaries created at different pipeline stages without merge policy
- Weak entity normalization across retrieval hits

**Diagnostics**

- Inspect stored snippets for overlapping citations or URLs
- Compare timestamps and source IDs for entries about the same entity
- Run the same query twice and check whether retrieved sets diverge without new inputs

### Drift as memory grows

**Symptoms**

- Early constraints or definitions stop appearing in later outputs
- Style or terminology shifts across sections of a long article
- Agent behavior changes after many curation rounds even with stable prompts

**Likely causes**

- Unbounded append-only memory without refresh or pruning
- Retrieval biased toward recent entries
- Summarization that drops low-salience but still binding constraints

**Diagnostics**

- Track memory size and retrieval rank over time
- Spot-check whether early canonical facts still appear in top-k retrieval
- Compare outputs before and after large memory growth on fixed test queries

### Forgetting important constraints

**Symptoms**

- Safety, scope, or task constraints disappear in later turns
- Critical definitions from the topic brief are omitted in final articles
- Follow-up answers contradict earlier grounded statements

**Likely causes**

- Context window limits truncating early conversation or outline content
- Summaries that prioritize novelty over constraint preservation
- Retrieval failing to surface constraint-bearing snippets

**Diagnostics**

- Log which memory entries were retrieved for each generation step
- Maintain a checklist of non-negotiable constraints and verify each final output against it
- Test with adversarial follow-up questions that require earlier constraints

### Preserving irrelevant detail

**Symptoms**

- Final articles include tangential facts that do not support the topic
- Retrieval noise dominates section planning
- Long memory increases latency without improving answer quality

**Likely causes**

- Over-inclusive ingestion without relevance filtering
- Retrieval models tuned for recall rather than precision
- Missing post-retrieval reranking or citation filtering

**Diagnostics**

- Measure precision@k on a small labeled query set
- Review discarded vs. kept snippets during curation
- Compare article quality with and without memory enabled on identical prompts

## Experiment and issue checklist

Before reporting a STORM bug or publishing benchmark results, consider:

1. **Memory policy** — Is memory append-only, refreshed, or deduplicated between runs?
2. **Retrieval configuration** — Which retriever, top-k, and reranker settings were used?
3. **Source of truth** — What is the canonical store: raw pages, summaries, or vector chunks?
4. **Constraint set** — What must remain true across all outputs for this topic?
5. **Regression queries** — Which fixed queries should produce stable citations over time?
6. **Baseline without memory** — Does the failure reproduce when memory is disabled or reset?

## Related STORM components

- `knowledge_storm/storm_wiki/modules/knowledge_curation.py` — curation loop
- `knowledge_storm/storm_wiki/modules/retriever.py` — retrieval integration
- `knowledge_storm/collaborative_storm/modules/knowledge_base_summary.py` — collaborative memory summaries

When filing an issue, include the topic, retrieval model, memory size, and examples of inconsistent or drifting outputs.
