"""Start the PaperStorm FastAPI service for local demos."""

import argparse
import os
import sys
from pathlib import Path


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


def build_parser():
    parser = argparse.ArgumentParser(description="Start PaperStorm Agent service.")
    parser.add_argument("--service-root", default="./results/paperstorm_demo_service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--log-level", default="info")
    return parser


def print_demo_runbook(args):
    service_url = "http://{0}:{1}".format(args.host, args.port)
    print("PaperStorm service URL: {0}".format(service_url))
    print("Dashboard file: frontend/paperstorm_dashboard/index.html")
    print("Demo lifecycle: submit -> queued -> running -> succeeded/failed")
    print("Use run_mode=fake for a no-key local demo; use paperstorm for real LLM runs.")


def main():
    args = build_parser().parse_args()
    print_demo_runbook(args)
    try:
        import uvicorn
    except ImportError as exc:
        raise RuntimeError(
            "Starting the service requires optional dependency uvicorn."
        ) from exc
    from examples.storm_examples.paperstorm_service_api import create_app

    uvicorn.run(
        create_app(service_root=Path(args.service_root)),
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
