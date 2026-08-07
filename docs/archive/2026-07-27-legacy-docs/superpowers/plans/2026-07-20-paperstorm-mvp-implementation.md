# PaperStorm MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable PaperStorm MVP by adding arXiv and local PDF retrieval backends that can feed STORM's existing Retriever/Information pipeline.

**Architecture:** Keep STORM's existing RM contract: each backend accepts `query_or_queries` and returns dicts with `url`, `title`, `description`, and `snippets`. `ArxivRM` adapts arXiv Atom metadata into this schema; `LocalPDFRM` ingests local PDFs into text chunks and retrieves relevant chunks.

**Tech Stack:** Python unittest, requests, xml.etree.ElementTree, pypdf for PDF text extraction, existing STORM `Retriever` and `Information` schema.

---

### Task 1: Add ArxivRM

**Files:**
- Modify: `knowledge_storm/rm.py`
- Create: `tests/test_paperstorm_retrievers.py`

- [x] Write failing tests for parsing arXiv Atom XML into STORM result dicts.
- [x] Run the new test and verify it fails because `ArxivRM` is missing.
- [x] Implement `ArxivRM` with `request()`, `_parse_response()`, `forward()`, usage accounting, URL filtering, and empty-query skipping.
- [x] Run `tests.test_paperstorm_retrievers` and existing `tests.test_minimax_runtime_fixes`.

### Task 2: Add LocalPDFRM

**Files:**
- Modify: `knowledge_storm/rm.py`
- Modify: `requirements.txt`
- Modify: `tests/test_paperstorm_retrievers.py`

- [x] Write failing tests for chunking local document text and returning STORM result dicts.
- [x] Implement `LocalPDFRM` with PDF text extraction, chunking, simple lexical scoring, and source metadata.
- [x] Add `pypdf` to `requirements.txt`.
- [x] Run retriever tests and existing runtime tests.

### Task 3: Add PaperStorm Example Entrypoint

**Files:**
- Create: `examples/storm_examples/run_paper_storm_minimax.py`
- Modify: `docs/paperstorm-mvp-learning-plan.md`

- [x] Add a MiniMax example script that supports `--retriever arxiv` and `--retriever local-pdf`.
- [x] Reuse existing topic/output-language/output-dir helpers from the MiniMax STORM runner.
- [ ] Document the first runnable commands.
- [x] Run import-level tests.

### Task 4: Commit and Push

**Files:**
- Commit only PaperStorm implementation files and documentation.

- [x] Run `D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest tests.test_paperstorm_retrievers tests.test_minimax_runtime_fixes -v`.
- [ ] Commit with a focused message.
- [ ] Push to `fork` using proxy if plain HTTPS push is reset.
