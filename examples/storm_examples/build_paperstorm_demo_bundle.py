"""
Build sample data for the static PaperStorm dashboard.

Example:
    python examples/storm_examples/build_paperstorm_demo_bundle.py \
        --output-dir frontend/paperstorm_dashboard
"""

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from knowledge_storm.paperstorm_demo import build_demo_bundle


def main():
    parser = argparse.ArgumentParser(description="Build PaperStorm dashboard sample data.")
    parser.add_argument("--output-dir", default="frontend/paperstorm_dashboard")
    args = parser.parse_args()
    bundle = build_demo_bundle(Path(args.output_dir))
    print(json.dumps(bundle, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
