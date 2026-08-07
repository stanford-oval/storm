import json
from pathlib import Path

from .paperstorm_service import PaperStormTaskService


def build_release_demo(
    service_root,
    dashboard_dir=None,
    topic="pim 神经网络抑制",
):
    """Build a deterministic release demo from the service layer."""

    service_root = Path(service_root)
    service = PaperStormTaskService(root_dir=service_root, max_concurrent_tasks=2)
    task = service.submit_research_task(
        topic=topic,
        retriever="arxiv",
        output_language="zh",
        run_mode="fake",
        expected_keywords=["passive intermodulation", "RF"],
        forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
    )
    finished = service.run_task(task["task_id"])
    qa = service.query_knowledge_base(task["task_id"], "PIM 是什么？")
    bundle = service.get_dashboard_bundle(task["task_id"])
    bundle["project"]["version"] = "v1.0"
    bundle["project"][
        "description"
    ] = "Release demo for RAG + Memory + Runtime Trace + Eval + Dashboard"
    bundle["release_demo"] = {
        "entrypoint": "examples/storm_examples/run_paperstorm_release_demo.py",
        "scenario": "中文论文调研 Agent 演示：PIM 指 passive intermodulation，不是 RAM/DRAM。",
        "interview_keywords": [
            "RAG",
            "Memory",
            "Tool Calling",
            "MCP-style schema",
            "Runtime Trace",
            "Eval Harness",
            "Task Service",
            "Dashboard",
        ],
    }

    dashboard_data = ""
    dashboard_js = ""
    if dashboard_dir is not None:
        dashboard_bundle = _sanitize_demo_paths(bundle, service_root.parent)
        dashboard_data, dashboard_js = write_dashboard_sample(
            dashboard_dir,
            dashboard_bundle,
        )

    output_dir = Path(finished["output_dir"])
    scorecard = service.get_scorecard(task["task_id"])
    score_total = scorecard.get("scores", {}).get("total", 0)
    summary = {
        "version": "v1.0",
        "task_id": task["task_id"],
        "task_status": finished["status"],
        "service_root": str(service_root),
        "dashboard_data": dashboard_data,
        "dashboard_js": dashboard_js,
        "article_path": str(output_dir / "storm_gen_article_polished.txt"),
        "trace_path": str(output_dir / "paperstorm_trace.jsonl"),
        "scorecard_path": str(output_dir / "scorecard.json"),
        "score_total": score_total,
        "qa_answer": qa.get("answer", ""),
    }
    summary_path = service_root / "release_demo_summary.json"
    summary["summary_path"] = str(summary_path)
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


def write_dashboard_sample(dashboard_dir, bundle):
    dashboard_dir = Path(dashboard_dir)
    dashboard_dir.mkdir(parents=True, exist_ok=True)
    data_path = dashboard_dir / "sample_data.json"
    js_path = dashboard_dir / "sample_data.js"
    data_path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    js_path.write_text(
        "window.PAPERSTORM_SAMPLE_DATA = "
        + json.dumps(bundle, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    return str(data_path), str(js_path)


def _sanitize_demo_paths(value, root_path):
    if isinstance(value, dict):
        return {
            key: _sanitize_demo_paths(item, root_path)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_demo_paths(item, root_path) for item in value]
    if isinstance(value, str):
        return value.replace(str(root_path), "demo://paperstorm_release")
    return value
