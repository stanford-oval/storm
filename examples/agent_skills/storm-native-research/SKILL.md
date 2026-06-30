---
name: storm-native-research
description: Execute a STORM-inspired research and writing workflow using the currently active agent model and available browsing/search tools, without calling the Stanford STORM Python package or requiring OpenAI API keys. Use when the user asks for native STORM, STORM-like research, subscription-based agent research, multi-perspective source-grounded article drafting, cited reports, deep topic research, outline-first synthesis, or a no-API alternative to the STORM package.
---

# Native STORM Research

Use this skill to imitate the useful parts of STORM inside the current agent
session. Do not run the local `knowledge-storm` package, do not request
`OPENAI_API_KEY`, and do not call external LLM APIs unless the user explicitly
asks.

This workflow consumes the active agent's normal model/session usage. In Codex,
use Codex capabilities and available tools. In Claude Code, use Claude Code
capabilities and available tools.

## Workflow

1. Clarify the target only if needed: topic, audience, output length, recency
   needs, and whether the user wants a brief, outline, article, or report.
2. Build 4-6 perspectives that would ask different questions about the topic,
   such as technical, historical, economic, policy, user/customer, skeptical,
   or implementation perspectives.
3. For each perspective, generate focused research questions. Prefer questions
   that expose tradeoffs, timelines, definitions, evidence, failure modes, and
   current uncertainty.
4. Gather sources using available search/browsing tools when the task needs
   current facts, citations, direct quotes, niche information, or high-stakes
   accuracy. Use primary or authoritative sources when possible.
5. Keep source notes compact: title, URL, date if visible, relevant claim, and
   any caveat.
6. Cross-check important claims across sources. Mark unresolved conflicts
   instead of smoothing them over.
7. Create an outline before drafting. Ensure each major section has evidence
   assigned to it.
8. Draft the requested artifact with citations or source links. Make the result
   readable, not a source dump.
9. Add a short "Limits / Open Questions" section when facts are uncertain,
   sources are thin, or the topic is fast-moving.

## Output Modes

Choose the mode that best matches the user's wording:

- `brief`: concise answer with key findings and links.
- `outline`: structured outline with evidence notes.
- `article`: Wikipedia-style or explainer-style draft with citations.
- `report`: executive summary, findings, implications, and recommendations.
- `research log`: perspectives, questions, sources, and synthesis notes.

If the user says "run STORM" but also says "no API", use this native workflow
and say that it is STORM-style rather than the Stanford implementation.

## Source Discipline

Prefer:

- Official documentation, standards, filings, primary research, government or
  public datasets, company pages, and reputable reporting.
- Recent sources for recent facts.
- Multiple independent sources for claims that drive conclusions.

Avoid:

- Presenting unsourced model memory as researched fact.
- Burying weak evidence under confident prose.
- Over-quoting. Paraphrase unless a short quote is necessary.

When browsing is not available, be explicit that the result is based on
available context and model knowledge, and ask whether the user wants a
browsing-capable follow-up.

## Native vs Official STORM

Use this distinction clearly:

- Native STORM-style workflow: this skill, uses the current agent/model/session,
  no API key, flexible, conversational, not identical to the paper
  implementation.
- Official STORM package: the Python examples in this repository, using
  `knowledge-storm`, model/retriever credentials, and repository-style output
  files.

If the user asks for exact STORM or Co-STORM behavior, use the package examples.
If the user asks to use the active agent instead of API keys, stay with this
skill.

## Practical Defaults

Unless the user specifies otherwise:

- Use 5 perspectives.
- Use 8-12 good sources for a substantial report, fewer for a brief.
- Put citations inline as links.
- Start with a compact executive summary.
- Keep research notes out of the final answer unless the user asks for them.
- For long artifacts, save a Markdown file when that is more useful than a
  chat-only answer.
