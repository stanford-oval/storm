"""Build a deterministic v1.0 PaperStorm release demo."""

import argparse
import json
import os
import sys
from pathlib import Path


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from knowledge_storm.paperstorm_release import build_release_demo


def main():
    parser = argparse.ArgumentParser(description="Build PaperStorm v1.0 release demo.")
    parser.add_argument("--topic", default="pim 神经网络抑制")
    parser.add_argument("--service-root", default="./results/paperstorm_release_demo")
    parser.add_argument("--dashboard-dir", default="frontend/paperstorm_dashboard")
    args = parser.parse_args()

    summary = build_release_demo(
        service_root=Path(args.service_root),
        dashboard_dir=Path(args.dashboard_dir),
        topic=args.topic,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
