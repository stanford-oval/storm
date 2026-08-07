import json
import re
from pathlib import Path
from typing import Dict, List, Optional

from .paperstorm_memory import PaperStormMemoryStore


class PaperStormKnowledgeBase:
    def __init__(self, documents: List[Dict], run_dir: Optional[Path] = None):
        self.documents = documents
        self.run_dir = Path(run_dir) if run_dir else None

    @classmethod
    def from_run_dir(cls, run_dir):
        run_dir = Path(run_dir)
        documents = []
        article = _read_first_existing(
            [
                run_dir / "storm_gen_article_polished.txt",
                run_dir / "storm_gen_article.txt",
            ]
        )
        if article:
            for index, paragraph in enumerate(_split_paragraphs(article), start=1):
                documents.append(
                    {
                        "id": "article-{0}".format(index),
                        "title": "Generated article paragraph {0}".format(index),
                        "content": paragraph,
                        "url": str(run_dir / "storm_gen_article_polished.txt"),
                        "source": "article",
                    }
                )

        raw_results = _read_json(run_dir / "raw_search_results.json", [])
        for index, result in enumerate(raw_results if isinstance(raw_results, list) else [], start=1):
            snippets = result.get("snippets") or []
            content = "\n".join(
                [
                    str(result.get("title") or ""),
                    str(result.get("description") or ""),
                    "\n".join(str(snippet) for snippet in snippets),
                ]
            ).strip()
            if content:
                documents.append(
                    {
                        "id": "retrieval-{0}".format(index),
                        "title": result.get("title") or "Retrieved source {0}".format(index),
                        "content": content,
                        "url": result.get("url") or "",
                        "source": "retrieval",
                    }
                )
        return cls(documents=documents, run_dir=run_dir)

    def answer_question(
        self,
        question: str,
        memory_store: Optional[PaperStormMemoryStore] = None,
        top_k: int = 3,
    ):
        question = str(question or "").strip()
        if not question:
            raise ValueError("question is required")
        evidence = self.search(question, top_k=top_k)
        memory_context = (
            memory_store.get_context_bundle(query=question, max_items=3)
            if memory_store
            else {}
        )
        answer = _compose_answer(question, evidence, memory_context)
        return {
            "question": question,
            "answer": answer,
            "citations": [_citation_from_doc(index, doc) for index, doc in enumerate(evidence, start=1)],
            "grounded": bool(evidence),
            "memory_context": memory_context,
            "evidence": evidence,
        }

    def search(self, query: str, top_k: int = 3):
        terms = _tokenize(query)
        scored = []
        for index, doc in enumerate(self.documents):
            text = "{0}\n{1}".format(doc.get("title", ""), doc.get("content", ""))
            score = len(terms & _tokenize(text))
            if score == 0 and _contains_cjk(query):
                score = _cjk_overlap(query, text)
            scored.append((score, index, doc))
        scored.sort(key=lambda item: (item[0], -item[1]), reverse=True)
        selected = [doc for score, _, doc in scored if score > 0]
        if not selected:
            selected = self.documents[:top_k]
        return selected[:top_k]


def write_qa_artifact(run_dir, answer) -> Path:
    run_dir = Path(run_dir)
    path = run_dir / "qa_answer.json"
    path.write_text(json.dumps(answer, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _compose_answer(question: str, evidence: List[Dict], memory_context: Dict):
    if not evidence:
        return "没有找到足够证据回答该问题。"
    sentences = []
    for index, doc in enumerate(evidence, start=1):
        content = _first_sentence(doc.get("content", ""))
        if content:
            sentences.append("{0}[{1}]".format(content, index))
    memory_hint = _memory_hint(memory_context)
    if memory_hint:
        sentences.insert(0, memory_hint)
    return " ".join(sentences)


def _memory_hint(memory_context: Dict):
    for layer in ("semantic", "episodic", "working"):
        records = memory_context.get(layer) or []
        if records:
            return records[0].get("content", "")
    return ""


def _citation_from_doc(index: int, doc: Dict):
    return {
        "id": index,
        "title": doc.get("title") or "",
        "url": doc.get("url") or "",
        "source": doc.get("source") or "",
        "document_id": doc.get("id") or "",
    }


def _read_first_existing(paths):
    for path in paths:
        if path.exists():
            return path.read_text(encoding="utf-8", errors="replace")
    return ""


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _split_paragraphs(text: str):
    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", text) if item.strip()]
    return [item for item in paragraphs if not item.startswith("#")]


def _first_sentence(text: str):
    text = " ".join(str(text or "").split())
    if not text:
        return ""
    match = re.search(r"(.+?[。.!?])\s", text + " ")
    if match:
        return match.group(1)
    return text[:240]


def _tokenize(text: str):
    return set(re.findall(r"[a-zA-Z0-9_\-]+|[\u4e00-\u9fff]+", str(text).lower()))


def _contains_cjk(text: str):
    return bool(re.search(r"[\u4e00-\u9fff]", text))


def _cjk_overlap(query: str, text: str):
    query_chars = set(re.findall(r"[\u4e00-\u9fff]", query))
    text_chars = set(re.findall(r"[\u4e00-\u9fff]", text))
    return len(query_chars & text_chars)
