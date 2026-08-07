import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List


class PlannerAgent:
    name = "PlannerAgent"

    def run(self, inputs: Dict):
        topic = str(inputs.get("topic") or "").strip()
        expected_keywords = inputs.get("expected_keywords") or []
        queries = []
        canonical_topic = _canonical_topic(topic, expected_keywords)
        queries.append(
            {
                "query": canonical_topic,
                "intent": "definition",
                "source": "topic",
            }
        )
        queries.append(
            {
                "query": canonical_topic + " suppression neural network",
                "intent": "method",
                "source": "topic+method",
            }
        )
        if expected_keywords:
            queries.append(
                {
                    "query": " ".join(expected_keywords),
                    "intent": "disambiguation",
                    "source": "expected_keywords",
                }
            )
        return {"agent": self.name, "topic": topic, "queries": _dedupe_queries(queries)}


class RetrieverAgent:
    name = "RetrieverAgent"

    def run(self, inputs: Dict):
        session = inputs["session"]
        search_tool = inputs["search_tool"]
        top_k = int(inputs.get("top_k") or 3)
        results = []
        for query_item in inputs.get("queries") or []:
            tool_output = session.call_tool(
                search_tool,
                {"query": query_item["query"], "top_k": top_k},
                stage="retrieval",
            )
            for result in tool_output.get("results") or []:
                result = dict(result)
                result["query"] = query_item["query"]
                result["query_intent"] = query_item.get("intent", "")
                results.append(result)
        return {"agent": self.name, "results": _dedupe_results(results)}


class CriticAgent:
    name = "CriticAgent"

    def run(self, inputs: Dict):
        expected_keywords = inputs.get("expected_keywords") or []
        forbidden_keywords = inputs.get("forbidden_keywords") or []
        kept = []
        rejected = []
        for result in inputs.get("results") or []:
            text = _result_text(result)
            forbidden_hits = _keyword_hits(text, forbidden_keywords)
            expected_hits = _keyword_hits(text, expected_keywords)
            reviewed = dict(result)
            reviewed["expected_hits"] = expected_hits
            reviewed["forbidden_hits"] = forbidden_hits
            if forbidden_hits:
                reviewed["reason"] = "contains forbidden keyword: " + ", ".join(forbidden_hits)
                rejected.append(reviewed)
            elif expected_keywords and not expected_hits:
                reviewed["reason"] = "missing expected domain keyword"
                rejected.append(reviewed)
            else:
                reviewed["reason"] = "matches expected domain evidence"
                kept.append(reviewed)
        return {"agent": self.name, "kept": kept, "rejected": rejected}


class MemoryAgent:
    name = "MemoryAgent"

    def run(self, inputs: Dict):
        memory = inputs["memory"]
        topic = inputs.get("topic", "")
        rejected = inputs.get("rejected") or []
        kept = inputs.get("kept") or []
        if kept:
            memory.remember_episode(
                "{0}: kept {1} relevant retrieval result(s).".format(topic, len(kept)),
                metadata={"topic": topic, "kept_count": len(kept)},
            )
        for result in rejected:
            memory.remember_episode(
                "{0}: rejected off-topic result '{1}' because {2}".format(
                    topic,
                    result.get("title", ""),
                    result.get("reason", ""),
                ),
                metadata={"topic": topic, "reason": result.get("reason", "")},
            )
        return {
            "agent": self.name,
            "episodic_count": len(memory.episodic),
            "semantic_count": len(memory.semantic),
        }


class EvaluatorAgent:
    name = "EvaluatorAgent"

    def run(self, inputs: Dict):
        kept = inputs.get("kept") or []
        rejected = inputs.get("rejected") or []
        query_plan = inputs.get("query_plan") or []
        agent_count = len(inputs.get("agents") or [])
        score = 0.0
        score += 25.0 if query_plan else 0.0
        score += 25.0 if kept else 0.0
        score += 20.0 if rejected else 0.0
        score += min(30.0, agent_count * 6.0)
        return {
            "agent": self.name,
            "scores": {
                "multi_agent_trace": round(score, 2),
                "critic_signal": 20.0 if rejected else 0.0,
            },
            "checks": {
                "has_query_plan": bool(query_plan),
                "has_kept_results": bool(kept),
                "critic_rejected_offtopic": bool(rejected),
            },
        }


class PaperStormResearchOrchestrator:
    def __init__(self, session, output_dir):
        self.session = session
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.agent_trace_path = self.output_dir / "agent_trace.jsonl"
        self.planner = PlannerAgent()
        self.retriever = RetrieverAgent()
        self.critic = CriticAgent()
        self.memory_agent = MemoryAgent()
        self.evaluator = EvaluatorAgent()

    def run(
        self,
        topic: str,
        search_tool: str,
        expected_keywords: List[str],
        forbidden_keywords: List[str],
        top_k: int = 3,
    ):
        plan = self._run_agent(
            self.planner,
            {"topic": topic, "expected_keywords": expected_keywords},
        )
        retrieved = self._run_agent(
            self.retriever,
            {
                "session": self.session,
                "search_tool": search_tool,
                "queries": plan["queries"],
                "top_k": top_k,
            },
        )
        reviewed = self._run_agent(
            self.critic,
            {
                "results": retrieved["results"],
                "expected_keywords": expected_keywords,
                "forbidden_keywords": forbidden_keywords,
            },
        )
        self._run_agent(
            self.memory_agent,
            {
                "memory": self.session.memory,
                "topic": topic,
                "kept": reviewed["kept"],
                "rejected": reviewed["rejected"],
            },
        )
        evaluation = self._run_agent(
            self.evaluator,
            {
                "query_plan": plan["queries"],
                "kept": reviewed["kept"],
                "rejected": reviewed["rejected"],
                "agents": [
                    self.planner.name,
                    self.retriever.name,
                    self.critic.name,
                    self.memory_agent.name,
                    self.evaluator.name,
                ],
            },
        )
        report = {
            "topic": topic,
            "query_plan": plan["queries"],
            "retrieved_results": retrieved["results"],
            "kept_results": reviewed["kept"],
            "rejected_results": reviewed["rejected"],
            "metrics": {
                "query_count": len(plan["queries"]),
                "retrieved_count": len(retrieved["results"]),
                "kept_count": len(reviewed["kept"]),
                "rejected_count": len(reviewed["rejected"]),
            },
            "evaluation": evaluation,
        }
        (self.output_dir / "multi_agent_report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return report

    def _run_agent(self, agent, inputs):
        self._record_agent_event(agent.name, "agent_start", inputs)
        output = agent.run(inputs)
        self._record_agent_event(agent.name, "agent_end", output)
        return output

    def _record_agent_event(self, agent: str, event: str, payload: Dict):
        record = {
            "event": event,
            "agent": agent,
            "run_id": self.session.run_id,
            "task_id": self.session.task_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload_summary": _summarize_payload(payload),
        }
        with self.agent_trace_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def evaluate_multi_agent_report(output_dir):
    output_dir = Path(output_dir)
    report = _read_json(output_dir / "multi_agent_report.json", {})
    agent_events = _load_jsonl(output_dir / "agent_trace.jsonl")
    agent_names = {event.get("agent") for event in agent_events}
    rejected = report.get("rejected_results") or []
    query_plan = report.get("query_plan") or []
    kept = report.get("kept_results") or []
    critic_rejected = any("forbidden" in str(item.get("reason", "")) for item in rejected)
    trace_score = min(40.0, len(agent_names) * 8.0)
    plan_score = 20.0 if query_plan else 0.0
    critic_score = 25.0 if critic_rejected else 0.0
    result_score = 15.0 if kept else 0.0
    total = trace_score + plan_score + critic_score + result_score
    return {
        "scores": {
            "total": round(total, 2),
            "multi_agent_trace": round(trace_score, 2),
            "query_planning": round(plan_score, 2),
            "critic_signal": round(critic_score, 2),
            "result_quality": round(result_score, 2),
        },
        "metrics": {
            "agent_count": len(agent_names),
            "query_count": len(query_plan),
            "kept_count": len(kept),
            "rejected_count": len(rejected),
        },
        "checks": {
            "has_agent_trace": bool(agent_events),
            "has_query_plan": bool(query_plan),
            "critic_rejected_offtopic": critic_rejected,
        },
    }


def _canonical_topic(topic: str, expected_keywords: List[str]):
    lowered = topic.lower()
    if "pim" in lowered and any("passive intermodulation" in item.lower() for item in expected_keywords):
        return "passive intermodulation RF neural network suppression"
    if expected_keywords:
        return " ".join(expected_keywords)
    return topic


def _dedupe_queries(queries: List[Dict]):
    seen = set()
    deduped = []
    for item in queries:
        query = item["query"].strip()
        if query and query not in seen:
            seen.add(query)
            deduped.append(dict(item, query=query))
    return deduped


def _dedupe_results(results: List[Dict]):
    seen = set()
    deduped = []
    for result in results:
        key = result.get("url") or result.get("title") or json.dumps(result, sort_keys=True)
        if key not in seen:
            seen.add(key)
            deduped.append(result)
    return deduped


def _keyword_hits(text: str, keywords: Iterable[str]):
    lowered = text.lower()
    return [keyword for keyword in keywords if keyword and keyword.lower() in lowered]


def _result_text(result: Dict):
    return "\n".join(
        [
            str(result.get("title") or ""),
            str(result.get("description") or ""),
            "\n".join(str(item) for item in result.get("snippets") or []),
        ]
    )


def _summarize_payload(payload):
    summary = {}
    for key, value in (payload or {}).items():
        if key == "session":
            summary[key] = {"type": "PaperStormRuntimeSession"}
        elif isinstance(value, list):
            summary[key] = {"type": "list", "count": len(value)}
        elif isinstance(value, dict):
            summary[key] = {"type": "object", "keys": sorted(value.keys())[:10]}
        elif isinstance(value, (str, int, float, bool)) or value is None:
            summary[key] = value
        else:
            summary[key] = {"type": type(value).__name__}
    return summary


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _load_jsonl(path: Path):
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            events.append({"event": "decode_error"})
    return events
