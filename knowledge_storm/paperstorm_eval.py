import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


@dataclass
class EvalCase:
    topic: str
    expected_keywords: List[str] = field(default_factory=list)
    forbidden_keywords: List[str] = field(default_factory=list)
    expected_language: str = "original"
    min_sources: int = 1

    @classmethod
    def from_dict(cls, data):
        return cls(
            topic=data["topic"],
            expected_keywords=data.get("expected_keywords") or [],
            forbidden_keywords=data.get("forbidden_keywords") or [],
            expected_language=data.get("expected_language", "original"),
            min_sources=int(data.get("min_sources", 1)),
        )


def load_eval_cases(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [EvalCase.from_dict(item) for item in data]


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _iter_result_texts(raw_results) -> Iterable[str]:
    for result in raw_results or []:
        if isinstance(result, dict):
            yield str(result.get("title") or "")
            yield str(result.get("description") or "")
            for snippet in result.get("snippets") or []:
                yield str(snippet)
        else:
            yield str(result)


def _count_offtopic_results(raw_results, forbidden_keywords: Iterable[str]) -> int:
    count = 0
    for result in raw_results or []:
        text = "\n".join(_iter_result_texts([result]))
        if _count_keyword_hits(text, forbidden_keywords):
            count += 1
    return count


def _count_keyword_hits(text: str, keywords: Iterable[str]) -> List[str]:
    lowered = text.lower()
    hits = []
    for keyword in keywords:
        if keyword and keyword.lower() in lowered:
            hits.append(keyword)
    return hits


def _chinese_char_ratio(text: str) -> float:
    if not text:
        return 0.0
    chinese_count = len(re.findall(r"[\u4e00-\u9fff]", text))
    visible_count = len(re.findall(r"\S", text))
    if visible_count == 0:
        return 0.0
    return chinese_count / visible_count


def _load_trace_events(path: Path) -> List[Dict]:
    events = []
    if not path.exists():
        return events
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            events.append({"event": "trace_decode_error", "raw": line})
    return events


def _score_completion(checks: Dict[str, bool]) -> float:
    points = 0.0
    points += 8.0 if checks["has_article"] else 0.0
    points += 5.0 if checks["has_outline"] else 0.0
    points += 4.0 if checks["has_search_results"] else 0.0
    points += 3.0 if checks["run_success"] else 0.0
    return points


def _score_retrieval(expected_hits: List[str], expected_total: int, source_count: int, min_sources: int) -> float:
    if expected_total == 0:
        keyword_score = 15.0
    else:
        keyword_score = 20.0 * min(1.0, len(expected_hits) / expected_total)
    source_score = 10.0 * min(1.0, source_count / max(1, min_sources))
    return keyword_score + source_score


def _score_article(article: str, expected_hits: List[str], expected_total: int, chinese_ratio: float, expected_language: str) -> float:
    length_score = 6.0 if len(article.strip()) >= 80 else (3.0 if article.strip() else 0.0)
    if expected_total == 0:
        coverage_score = 7.0
    else:
        coverage_score = 7.0 * min(1.0, len(expected_hits) / expected_total)
    language_score = 7.0
    if expected_language == "zh":
        language_score = 7.0 * min(1.0, chinese_ratio / 0.35)
    return length_score + coverage_score + language_score


def _score_trace(checks: Dict[str, bool], trace_events: List[Dict]) -> float:
    event_names = {event.get("event") for event in trace_events}
    points = 0.0
    points += 4.0 if checks["has_trace"] else 0.0
    points += 3.0 if "run_start" in event_names else 0.0
    points += 3.0 if "run_end" in event_names else 0.0
    points += 3.0 if "retrieval_start" in event_names or "tool_start" in event_names else 0.0
    points += 2.0 if "retrieval_end" in event_names or "tool_end" in event_names else 0.0
    return points


def evaluate_run(run_dir, case: EvalCase):
    run_dir = Path(run_dir)
    raw_results = _read_json(run_dir / "raw_search_results.json", [])
    summary = _read_json(run_dir / "run_summary.json", {})
    outline = _read_text(run_dir / "storm_gen_outline.txt")
    article = _read_text(run_dir / "storm_gen_article_polished.txt")
    if not article:
        article = _read_text(run_dir / "storm_gen_article.txt")
    trace_events = _load_trace_events(run_dir / "paperstorm_trace.jsonl")

    retrieval_text = "\n".join(_iter_result_texts(raw_results))
    article_and_retrieval = article + "\n" + retrieval_text
    expected_hits = _count_keyword_hits(article_and_retrieval, case.expected_keywords)
    forbidden_hits = _count_keyword_hits(article_and_retrieval, case.forbidden_keywords)
    offtopic_result_count = _count_offtopic_results(raw_results, case.forbidden_keywords)
    chinese_ratio = _chinese_char_ratio(article)
    source_count = len(raw_results) if isinstance(raw_results, list) else 0

    checks = {
        "has_article": bool(article.strip()),
        "has_outline": bool(outline.strip()),
        "has_search_results": source_count > 0,
        "has_trace": len(trace_events) > 0,
        "run_success": bool(summary.get("success")) or any(
            event.get("event") == "run_end" and event.get("success")
            for event in trace_events
        ),
    }

    completion = _score_completion(checks)
    retrieval = _score_retrieval(
        expected_hits=expected_hits,
        expected_total=len(case.expected_keywords),
        source_count=source_count,
        min_sources=case.min_sources,
    )
    offtopic_penalty = 15.0 * min(1.0, offtopic_result_count / max(1, source_count))
    article_score = _score_article(
        article=article,
        expected_hits=expected_hits,
        expected_total=len(case.expected_keywords),
        chinese_ratio=chinese_ratio,
        expected_language=case.expected_language,
    )
    trace_score = _score_trace(checks, trace_events)
    total = completion + retrieval + article_score + trace_score - offtopic_penalty
    total = max(0.0, min(100.0, total))

    notes = _build_notes(checks, forbidden_hits, expected_hits, case, source_count)
    return {
        "topic": case.topic,
        "scores": {
            "total": round(total, 2),
            "task_completion": round(completion, 2),
            "retrieval_quality": round(retrieval, 2),
            "offtopic_penalty": round(offtopic_penalty, 2),
            "article_quality": round(article_score, 2),
            "runtime_observability": round(trace_score, 2),
        },
        "metrics": {
            "source_count": source_count,
            "expected_hits": expected_hits,
            "forbidden_hits": forbidden_hits,
            "offtopic_result_count": offtopic_result_count,
            "chinese_char_ratio": round(chinese_ratio, 4),
            "trace_event_count": len(trace_events),
        },
        "checks": checks,
        "notes": notes,
    }


def evaluate_qa_artifact(run_dir, case: EvalCase):
    run_dir = Path(run_dir)
    qa = _read_json(run_dir / "qa_answer.json", {})
    answer = str(qa.get("answer") or "")
    citations = qa.get("citations") or []
    grounded = bool(qa.get("grounded"))
    expected_hits = _count_keyword_hits(answer, case.expected_keywords)
    forbidden_hits = _count_keyword_hits(answer, case.forbidden_keywords)
    chinese_ratio = _chinese_char_ratio(answer)

    keyword_score = 12.0
    if case.expected_keywords:
        keyword_score = 12.0 * min(1.0, len(expected_hits) / len(case.expected_keywords))
    citation_score = 8.0 if citations else 0.0
    grounded_score = 6.0 if grounded else 0.0
    language_score = 4.0
    if case.expected_language == "zh":
        language_score = 4.0 * min(1.0, chinese_ratio / 0.25)
    forbidden_penalty = 10.0 if forbidden_hits else 0.0
    qa_quality = keyword_score + citation_score + grounded_score + language_score
    total = max(0.0, min(100.0, qa_quality - forbidden_penalty))

    checks = {
        "qa_exists": bool(qa),
        "qa_has_answer": bool(answer.strip()),
        "qa_has_citation": bool(citations),
        "qa_grounded": grounded,
    }
    notes = []
    if not checks["qa_exists"]:
        notes.append("缺少 qa_answer.json。")
    if not checks["qa_has_citation"]:
        notes.append("问答缺少引用，不能证明答案来自知识库证据。")
    if forbidden_hits:
        notes.append("问答中出现跑题关键词：" + ", ".join(forbidden_hits))
    missing = [item for item in case.expected_keywords if item not in expected_hits]
    if missing:
        notes.append("问答未覆盖期望关键词：" + ", ".join(missing))
    if not notes:
        notes.append("问答结果满足当前知识库 QA 评估规则。")

    return {
        "topic": case.topic,
        "scores": {
            "total": round(total, 2),
            "qa_quality": round(qa_quality, 2),
            "forbidden_penalty": round(forbidden_penalty, 2),
        },
        "metrics": {
            "expected_hits": expected_hits,
            "forbidden_hits": forbidden_hits,
            "citation_count": len(citations),
            "chinese_char_ratio": round(chinese_ratio, 4),
        },
        "checks": checks,
        "notes": notes,
    }


def evaluate_multi_agent_report(run_dir):
    from .paperstorm_agents import evaluate_multi_agent_report as _evaluate

    return _evaluate(run_dir)


def _build_notes(checks, forbidden_hits, expected_hits, case, source_count) -> List[str]:
    notes = []
    if not checks["has_article"]:
        notes.append("缺少文章产物。")
    if not checks["has_outline"]:
        notes.append("缺少大纲产物。")
    if not checks["has_trace"]:
        notes.append("缺少 runtime trace，难以复盘工具调用链路。")
    if forbidden_hits:
        notes.append("检索或文章中出现跑题关键词：" + ", ".join(forbidden_hits))
    missing = [item for item in case.expected_keywords if item not in expected_hits]
    if missing:
        notes.append("未覆盖期望关键词：" + ", ".join(missing))
    if source_count < case.min_sources:
        notes.append("来源数量不足，当前 {0}，期望至少 {1}。".format(source_count, case.min_sources))
    if not notes:
        notes.append("本次运行的核心指标满足当前规则评估要求。")
    return notes


def write_scorecards(run_dir, scorecard) -> Tuple[Path, Path]:
    run_dir = Path(run_dir)
    json_path = run_dir / "scorecard.json"
    md_path = run_dir / "scorecard.md"
    json_path.write_text(
        json.dumps(scorecard, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    md_path.write_text(_render_scorecard_markdown(scorecard), encoding="utf-8")
    return json_path, md_path


def _render_scorecard_markdown(scorecard) -> str:
    lines = [
        "# PaperStorm Eval Scorecard",
        "",
        "## Summary",
        "",
        "- Topic: {0}".format(scorecard.get("topic", "")),
        "- Total Score: {0}".format(scorecard.get("scores", {}).get("total", 0)),
        "",
        "## Scores",
        "",
    ]
    for name, value in scorecard.get("scores", {}).items():
        lines.append("- {0}: {1}".format(name, value))
    lines.extend(["", "## Metrics", ""])
    for name, value in scorecard.get("metrics", {}).items():
        lines.append("- {0}: {1}".format(name, value))
    lines.extend(["", "## Checks", ""])
    for name, value in scorecard.get("checks", {}).items():
        lines.append("- {0}: {1}".format(name, value))
    lines.extend(["", "## Notes", ""])
    for note in scorecard.get("notes", []):
        lines.append("- {0}".format(note))
    lines.append("")
    return "\n".join(lines)
