import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional


@dataclass
class MemoryRecord:
    kind: str
    content: str
    metadata: Dict = field(default_factory=dict)
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @classmethod
    def from_dict(cls, data):
        return cls(
            kind=data["kind"],
            content=data["content"],
            metadata=data.get("metadata") or {},
            id=data.get("id") or uuid.uuid4().hex,
            created_at=data.get("created_at")
            or datetime.now(timezone.utc).isoformat(),
        )


class PaperStormMemoryStore:
    """Small persistent memory store for PaperStorm runs and QA sessions."""

    def __init__(
        self,
        working: Optional[List[MemoryRecord]] = None,
        episodic: Optional[List[MemoryRecord]] = None,
        semantic: Optional[List[MemoryRecord]] = None,
        preferences: Optional[Dict] = None,
    ):
        self.working = working or []
        self.episodic = episodic or []
        self.semantic = semantic or []
        self.preferences = preferences or {}

    def append_working(self, content: str, metadata: Optional[Dict] = None):
        return self._append("working", content, metadata)

    def remember_episode(self, content: str, metadata: Optional[Dict] = None):
        return self._append("episodic", content, metadata)

    def remember_semantic(
        self,
        content: str,
        metadata: Optional[Dict] = None,
        tags: Optional[List[str]] = None,
    ):
        metadata = dict(metadata or {})
        if tags:
            metadata["tags"] = tags
        return self._append("semantic", content, metadata)

    def set_preference(self, key: str, value):
        self.preferences[key] = value

    def get_context_bundle(self, query: str = "", max_items: int = 5):
        return {
            "working": [asdict(item) for item in self._select(self.working, query, max_items)],
            "episodic": [asdict(item) for item in self._select(self.episodic, query, max_items)],
            "semantic": [asdict(item) for item in self._select(self.semantic, query, max_items)],
            "preferences": dict(self.preferences),
        }

    def save(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path):
        path = Path(path)
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls.from_dict(data)

    def to_dict(self):
        return {
            "working": [asdict(item) for item in self.working],
            "episodic": [asdict(item) for item in self.episodic],
            "semantic": [asdict(item) for item in self.semantic],
            "preferences": dict(self.preferences),
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            working=[MemoryRecord.from_dict(item) for item in data.get("working", [])],
            episodic=[MemoryRecord.from_dict(item) for item in data.get("episodic", [])],
            semantic=[MemoryRecord.from_dict(item) for item in data.get("semantic", [])],
            preferences=data.get("preferences") or {},
        )

    def _append(self, kind: str, content: str, metadata: Optional[Dict]):
        record = MemoryRecord(kind=kind, content=str(content), metadata=metadata or {})
        getattr(self, kind).append(record)
        return record

    @staticmethod
    def _select(records: List[MemoryRecord], query: str, max_items: int):
        if not query:
            return records[-max_items:]
        scored = []
        query_terms = _tokenize(query)
        for index, record in enumerate(records):
            content_terms = _tokenize(record.content + " " + json.dumps(record.metadata, ensure_ascii=False))
            score = len(query_terms & content_terms)
            scored.append((score, index, record))
        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        selected = [record for score, _, record in scored if score > 0]
        if not selected:
            selected = records[-max_items:]
        return selected[:max_items]


def compress_context(
    messages: Iterable[Dict],
    expected_keywords: Optional[List[str]] = None,
    forbidden_keywords: Optional[List[str]] = None,
    max_chars: int = 1200,
):
    expected_keywords = expected_keywords or []
    forbidden_keywords = forbidden_keywords or []
    lines = []
    for message in messages or []:
        role = message.get("role", "unknown")
        content = str(message.get("content") or "").strip()
        if content:
            lines.append("[{0}] {1}".format(role, content))
    full_text = "\n".join(lines)
    retained = _retain_relevant_lines(lines, expected_keywords, forbidden_keywords)
    if not retained:
        retained = lines[-6:]
    summary = "\n".join(retained)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 3].rstrip() + "..."

    expected_hits = _keyword_hits(summary, expected_keywords)
    forbidden_hits = _keyword_hits(summary, forbidden_keywords)
    return {
        "summary": summary,
        "retained_facts": retained,
        "constraints": {
            "expected_keywords": expected_keywords,
            "forbidden_keywords": forbidden_keywords,
            "max_chars": max_chars,
        },
        "source_event_count": len(lines),
        "source_char_count": len(full_text),
        "validation": {
            "expected_keyword_hits": expected_hits,
            "forbidden_keyword_hits": forbidden_hits,
            "passed": len(expected_hits) == len(expected_keywords)
            and len(forbidden_hits) == 0,
        },
    }


def _retain_relevant_lines(lines, expected_keywords, forbidden_keywords):
    keywords = [item for item in expected_keywords + forbidden_keywords if item]
    if not keywords:
        return lines[-6:]
    retained = []
    for line in lines:
        lowered = line.lower()
        if any(keyword.lower() in lowered for keyword in keywords):
            retained.append(line)
    return retained


def _keyword_hits(text: str, keywords: Iterable[str]) -> List[str]:
    lowered = text.lower()
    return [keyword for keyword in keywords if keyword and keyword.lower() in lowered]


def _tokenize(text: str):
    return set(re.findall(r"[a-zA-Z0-9_\-]+|[\u4e00-\u9fff]+", text.lower()))
