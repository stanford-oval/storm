"""
Run a fake PaperStorm service stress benchmark.

Example:
    python examples/storm_examples/benchmark_paperstorm_service.py \
        --output-dir ./results/paperstorm_service_benchmark \
        --total-tasks 50 \
        --max-concurrent-tasks 5 \
        --fail-every 10
"""

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from knowledge_storm.paperstorm_service import PaperStormTaskService


def main():
    parser = argparse.ArgumentParser(description="Benchmark the PaperStorm task service core.")
    parser.add_argument("--output-dir", default="./results/paperstorm_service_benchmark")
    parser.add_argument("--total-tasks", type=int, default=20)
    parser.add_argument("--max-concurrent-tasks", type=int, default=3)
    parser.add_argument("--fail-every", type=int, default=0)
    args = parser.parse_args()

    service = PaperStormTaskService(
        root_dir=Path(args.output_dir),
        max_concurrent_tasks=args.max_concurrent_tasks,
    )
    report = service.run_stress_benchmark(
        total_tasks=args.total_tasks,
        fail_every=args.fail_every,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
