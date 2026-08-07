"""
Run one PaperStorm task through the service core.

Example:
    python examples/storm_examples/run_paperstorm_service_task.py \
        --topic "retrieval augmented generation evaluation" \
        --run-mode paperstorm \
        --retriever arxiv \
        --llm-provider deepseek \
        --llm-model flash \
        --output-dir ./results/paperstorm_service_real \
        --max-conv-turn 1 \
        --max-perspective 1 \
        --search-top-k 2
"""

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from knowledge_storm.paperstorm_service import PaperStormTaskService


def build_parser():
    parser = argparse.ArgumentParser(description="Run a single PaperStorm service task.")
    parser.add_argument("--topic", required=True)
    parser.add_argument("--output-dir", default="./results/paperstorm_service")
    parser.add_argument("--output-language", choices=["original", "zh"], default="zh")
    parser.add_argument("--run-mode", choices=["fake", "paperstorm"], default="fake")
    parser.add_argument("--retriever", choices=["arxiv", "local-pdf"], default="arxiv")
    parser.add_argument("--pdf-dir", default=None)
    parser.add_argument("--llm-provider", choices=["minimax", "deepseek"], default="deepseek")
    parser.add_argument("--llm-model", default="flash")
    parser.add_argument("--max-thread-num", type=int, default=1)
    parser.add_argument("--max-conv-turn", type=int, default=1)
    parser.add_argument("--max-perspective", type=int, default=1)
    parser.add_argument("--search-top-k", type=int, default=2)
    parser.add_argument("--retrieve-top-k", type=int, default=3)
    parser.add_argument("--expected-keyword", action="append", default=[])
    parser.add_argument("--forbidden-keyword", action="append", default=[])
    parser.add_argument("--skip-research", action="store_true")
    parser.add_argument("--skip-outline", action="store_true")
    parser.add_argument("--skip-article", action="store_true")
    parser.add_argument("--skip-polish", action="store_true")
    parser.add_argument("--remove-duplicate", action="store_true")
    parser.add_argument("--disable-trace", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    service = PaperStormTaskService(root_dir=Path(args.output_dir))
    task = service.submit_research_task(
        topic=args.topic,
        retriever=args.retriever,
        output_language=args.output_language,
        run_mode=args.run_mode,
        expected_keywords=args.expected_keyword,
        forbidden_keywords=args.forbidden_keyword,
        pdf_dir=args.pdf_dir,
        llm_provider=args.llm_provider,
        llm_model=args.llm_model,
        max_thread_num=args.max_thread_num,
        max_conv_turn=args.max_conv_turn,
        max_perspective=args.max_perspective,
        search_top_k=args.search_top_k,
        retrieve_top_k=args.retrieve_top_k,
        do_research=not args.skip_research,
        do_generate_outline=not args.skip_outline,
        do_generate_article=not args.skip_article,
        do_polish_article=not args.skip_polish,
        remove_duplicate=args.remove_duplicate,
        disable_trace=args.disable_trace,
        verbose=args.verbose,
    )
    finished = service.run_task(task["task_id"])
    result = {
        "task": finished,
        "article": service.get_article(task["task_id"])["path"],
        "scorecard": str(Path(finished["output_dir"]) / "scorecard.json"),
        "trace": str(Path(finished["output_dir"]) / "paperstorm_trace.jsonl"),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if finished["status"] == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
