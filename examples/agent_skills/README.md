# Agent skill examples

This directory contains optional agent-skill examples for running a STORM-inspired
research workflow inside coding agents such as Codex and Claude Code.

These skills do **not** call the `knowledge-storm` Python package. Instead, they
guide the active agent to follow STORM's high-level research pattern:

1. Generate multiple perspectives on a topic.
2. Ask focused research questions from each perspective.
3. Gather and cross-check sources with the agent's available browsing/search tools.
4. Build an evidence-backed outline.
5. Draft a cited brief, article, or report.

Use the standard STORM examples under `examples/storm_examples/` when you need
the official package pipeline and reproducible output files. Use these agent
skills when you want a no-API-key, agent-native workflow that consumes the active
agent environment rather than the STORM Python runtime.

## Install for Codex

Copy the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R examples/agent_skills/storm-native-research ~/.codex/skills/
```

Restart Codex, then ask:

```text
Use $storm-native-research to research retrieval-augmented generation evaluation and draft a cited report.
```

## Install for Claude Code

Copy the same skill folder into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills
cp -R examples/agent_skills/storm-native-research ~/.claude/skills/
```

Restart Claude Code, then ask:

```text
Use $storm-native-research to research retrieval-augmented generation evaluation and draft a cited report.
```

## Notes

- The skill is STORM-inspired, not a replacement for the official STORM engine.
- It does not require `OPENAI_API_KEY` or retriever API keys from `secrets.toml`.
- It depends on the host agent's available model, browsing/search tools, and plan limits.
- For exact STORM or Co-STORM behavior, use the Python examples in this repository.
