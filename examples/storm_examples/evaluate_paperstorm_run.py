"""
Evaluate a PaperStorm run directory and write scorecard.json/scorecard.md.

Example:
    python examples/storm_examples/evaluate_paperstorm_run.py \
        --run-dir ./results/paperstorm_zh/PIM \
        --case-file examples/storm_examples/paperstorm_eval_cases.json \
        --topic "pim 神经网络抑制"
"""

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from knowledge_storm.paperstorm_eval import (
    EvalCase,
    evaluate_run,
    load_eval_cases,
    write_scorecards,
)


def select_case(cases, topic):
    for case in cases:
        if case.topic == topic:
            return case
    raise ValueError("No eval case found for topic: {0}".format(topic))


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate PaperStorm run artifacts with rule-based metrics."
    )
    parser.add_argument("--run-dir", required=True, help="PaperStorm run output directory.")
    parser.add_argument(
        "--case-file",
        default=None,
        help="JSON file containing eval cases. If omitted, a topic-only case is used.",
    )
    parser.add_argument(
        "--topic",
        required=True,
        help="Eval topic. Must match a case when --case-file is provided.",
    )
    args = parser.parse_args()

    if args.case_file:
        case = select_case(load_eval_cases(args.case_file), args.topic)
    else:
        case = EvalCase(topic=args.topic)

    scorecard = evaluate_run(args.run_dir, case)
    json_path, md_path = write_scorecards(args.run_dir, scorecard)
    print("PaperStorm eval score: {0}".format(scorecard["scores"]["total"]))
    print("Wrote {0}".format(json_path))
    print("Wrote {0}".format(md_path))


if __name__ == "__main__":
    main()
