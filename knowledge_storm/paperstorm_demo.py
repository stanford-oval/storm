import json
import tempfile
from copy import deepcopy
from pathlib import Path

from .paperstorm_agents import PaperStormResearchOrchestrator
from .paperstorm_runtime import PaperStormRuntimeSession
from .paperstorm_service import PaperStormTaskService


class DemoSearchTool:
    name = "demo_search"
    description = "Deterministic demo search tool for PaperStorm dashboard data."
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}, "top_k": {"type": "integer"}},
        "required": ["query"],
    }
    output_schema = {"type": "object"}

    def to_schema(self):
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
        }

    def run(self, arguments):
        return {
            "results": [
                {
                    "title": "Neural passive intermodulation cancellation",
                    "description": "RF passive intermodulation suppression with neural networks.",
                    "url": "https://example.com/pim",
                },
                {
                    "title": "Processing-in-memory accelerator",
                    "description": "DRAM and RAM architecture unrelated to RF PIM.",
                    "url": "https://example.com/ram",
                },
            ]
        }


def build_demo_bundle(output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_root = Path(temp_dir)
        service = PaperStormTaskService(root_dir=temp_root / "service", max_concurrent_tasks=2)
        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            run_mode="fake",
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
        )
        service.run_task(task["task_id"])
        qa = service.query_knowledge_base(task["task_id"], "PIM 是什么？")
        stress_report = service.run_stress_benchmark(total_tasks=6, fail_every=3)

        agent_output_dir = temp_root / "multi_agent"
        session = PaperStormRuntimeSession(
            run_id="demo-agents",
            task_id="demo-agents",
            trace_path=agent_output_dir / "paperstorm_trace.jsonl",
        )
        session.register_tool(DemoSearchTool())
        multi_agent = PaperStormResearchOrchestrator(
            session=session,
            output_dir=agent_output_dir,
        ).run(
            topic="pim 神经网络抑制",
            search_tool="demo_search",
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
        )

        task_state = deepcopy(service.get_task(task["task_id"]))
        article = deepcopy(service.get_article(task["task_id"]))
        task_state["output_dir"] = f"demo://paperstorm_dashboard/tasks/{task['task_id']}"
        article["path"] = "demo://paperstorm_dashboard/storm_gen_article_polished.txt"

        data = {
            "project": {
                "name": "PaperStorm Agent",
                "version": "v0.9",
                "description": "Task-control RAG + Memory + Multi-Agent dashboard demo",
            },
            "tasks": [task_state],
            "article": article,
            "qa": qa,
            "scorecard": service.get_scorecard(task["task_id"]),
            "trace": service.get_trace(task["task_id"]),
            "pipeline_worker": {
                "runner": "fake",
                "run_mode": "fake",
                "retriever": "arxiv",
                "status": "succeeded",
                "score": service.get_scorecard(task["task_id"])
                .get("scores", {})
                .get("total", ""),
            },
            "service_snapshot": {
                "task_id": task["task_id"],
                "output_dir": f"demo://paperstorm_dashboard/tasks/{task['task_id']}",
                "status": "succeeded",
                "run_mode": "fake",
                "retriever": "arxiv",
            },
            "multi_agent": multi_agent,
            "agent_trace": _load_jsonl(agent_output_dir / "agent_trace.jsonl"),
            "stress_report": stress_report,
        }
        data = _sanitize_demo_paths(data, temp_root)
    data_path = output_dir / "sample_data.json"
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    js_path = output_dir / "sample_data.js"
    js_path.write_text(
        "window.PAPERSTORM_SAMPLE_DATA = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    return {"data_path": str(data_path), "js_path": str(js_path), "task_id": task["task_id"]}


def _load_jsonl(path):
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            events.append({"event": "decode_error"})
    return events


def _sanitize_demo_paths(value, temp_root):
    if isinstance(value, dict):
        return {key: _sanitize_demo_paths(item, temp_root) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize_demo_paths(item, temp_root) for item in value]
    if isinstance(value, str):
        return value.replace(str(temp_root), "demo://paperstorm_dashboard")
    return value
