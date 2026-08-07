import json
import os
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

from . import STORMWikiLMConfigs, STORMWikiRunner, STORMWikiRunnerArguments
from .lm import LitellmModel
from .paperstorm_eval import EvalCase, evaluate_run, write_scorecards
from .rm import ArxivRM, LocalPDFRM
from .utils import load_api_key

from examples.storm_examples.run_paper_storm_minimax import (
    PaperStormTraceRecorder,
    TracedRetrievalModel,
    build_artifact_paths,
    build_lm_settings,
    build_lm_token_limits,
    configure_paperstorm_logging,
)
from examples.storm_examples.run_storm_wiki_minimax import get_topic_for_storm


@dataclass
class PaperStormPipelineConfig:
    topic: str
    topic_for_storm: str
    output_root: str
    output_dir_name: str
    article_dir: str
    output_language: str = "zh"
    llm_provider: str = "deepseek"
    llm_model: str = "flash"
    retriever: str = "arxiv"
    pdf_dir: str = ""
    max_thread_num: int = 1
    max_conv_turn: int = 1
    max_perspective: int = 1
    search_top_k: int = 2
    retrieve_top_k: int = 3
    do_research: bool = True
    do_generate_outline: bool = True
    do_generate_article: bool = True
    do_polish_article: bool = True
    remove_duplicate: bool = False
    disable_trace: bool = False
    verbose: bool = False
    expected_keywords: tuple = ()
    forbidden_keywords: tuple = ()


def build_pipeline_config_from_task_state(state):
    options = state.get("options") or {}
    article_dir = Path(state["output_dir"])
    topic = state["topic"]
    output_language = state.get("output_language", "zh")
    return PaperStormPipelineConfig(
        topic=topic,
        topic_for_storm=get_topic_for_storm(topic, output_language=output_language),
        output_root=str(article_dir.parent),
        output_dir_name=article_dir.name,
        article_dir=str(article_dir),
        output_language=output_language,
        llm_provider=options.get("llm_provider", "deepseek"),
        llm_model=options.get("llm_model", "flash"),
        retriever=state.get("retriever", "arxiv"),
        pdf_dir=options.get("pdf_dir") or "",
        max_thread_num=int(options.get("max_thread_num", 1)),
        max_conv_turn=int(options.get("max_conv_turn", 1)),
        max_perspective=int(options.get("max_perspective", 1)),
        search_top_k=int(options.get("search_top_k", 2)),
        retrieve_top_k=int(options.get("retrieve_top_k", 3)),
        do_research=bool(options.get("do_research", True)),
        do_generate_outline=bool(options.get("do_generate_outline", True)),
        do_generate_article=bool(options.get("do_generate_article", True)),
        do_polish_article=bool(options.get("do_polish_article", True)),
        remove_duplicate=bool(options.get("remove_duplicate", False)),
        disable_trace=bool(options.get("disable_trace", False)),
        verbose=bool(options.get("verbose", False)),
        expected_keywords=tuple(state.get("expected_keywords") or ()),
        forbidden_keywords=tuple(state.get("forbidden_keywords") or ()),
    )


def run_paperstorm_pipeline_task(state):
    config = build_pipeline_config_from_task_state(state)
    return run_paperstorm_pipeline(config)


def run_paperstorm_pipeline(config: PaperStormPipelineConfig):
    configure_paperstorm_logging(verbose=config.verbose)
    if os.path.exists("secrets.toml"):
        load_api_key(toml_file_path="secrets.toml")

    article_dir = Path(config.article_dir)
    article_dir.mkdir(parents=True, exist_ok=True)
    args = _config_to_namespace(config)
    settings = build_lm_settings(args)
    trace = PaperStormTraceRecorder(str(article_dir), enabled=not config.disable_trace)
    trace.emit(
        "run_start",
        topic=config.topic,
        topic_for_storm=config.topic_for_storm,
        output_dir=str(article_dir),
        llm_provider=config.llm_provider,
        llm_model=settings["model"],
        retriever=config.retriever,
        run_mode="paperstorm",
        do_research=config.do_research,
        do_generate_outline=config.do_generate_outline,
        do_generate_article=config.do_generate_article,
        do_polish_article=config.do_polish_article,
    )

    try:
        lm_configs = _build_lm_configs(args)
        engine_args = STORMWikiRunnerArguments(
            output_dir=config.output_root,
            max_conv_turn=config.max_conv_turn,
            max_perspective=config.max_perspective,
            search_top_k=config.search_top_k,
            max_thread_num=config.max_thread_num,
        )
        rm = _build_paper_retriever(args)
        if not config.disable_trace:
            rm = TracedRetrievalModel(
                rm,
                trace_recorder=trace,
                retriever_name=type(rm).__name__,
            )
        runner = STORMWikiRunner(engine_args, lm_configs, rm)
        runner.run(
            topic=config.topic_for_storm,
            output_dir_name=config.output_dir_name,
            do_research=config.do_research,
            do_generate_outline=config.do_generate_outline,
            do_generate_article=config.do_generate_article,
            do_polish_article=config.do_polish_article,
            remove_duplicate=config.remove_duplicate,
        )
        runner.post_run()
        runner.summary()
        artifact_paths = build_artifact_paths(str(article_dir))
        existing_artifacts = [
            path for path in artifact_paths.values() if os.path.exists(path)
        ]
        for artifact in existing_artifacts:
            trace.emit("artifact_written", path=artifact)
        _write_pipeline_scorecard(config)
        trace.emit("run_end", success=True)
        trace.write_summary(
            success=True,
            artifacts=existing_artifacts,
            extra={
                "topic": config.topic,
                "retriever": config.retriever,
                "llm_model": settings["model"],
                "output_dir": str(article_dir),
            },
        )
        return {
            "success": True,
            "article_dir": str(article_dir),
            "artifacts": existing_artifacts,
        }
    except Exception as error:
        trace.emit(
            "run_end",
            success=False,
            error_type=type(error).__name__,
            error=str(error),
        )
        trace.write_summary(
            success=False,
            error={"type": type(error).__name__, "message": str(error)},
            extra={
                "topic": config.topic,
                "retriever": config.retriever,
                "llm_model": settings["model"],
                "output_dir": str(article_dir),
            },
        )
        raise


def _config_to_namespace(config):
    return SimpleNamespace(
        llm_provider=config.llm_provider,
        llm_model=config.llm_model,
        retriever=config.retriever,
        pdf_dir=config.pdf_dir or None,
        search_top_k=config.search_top_k,
    )


def _build_lm_configs(args):
    settings = build_lm_settings(args)
    token_limits = build_lm_token_limits()
    api_key = os.getenv(settings["api_env"])
    if not api_key:
        raise ValueError(f"Please set {settings['api_env']} in secrets.toml.")

    llm_kwargs = {
        "api_key": api_key,
        "api_base": settings["api_base"],
        "temperature": 1.0,
        "top_p": 0.9,
    }
    model_name = settings["model"]

    lm_configs = STORMWikiLMConfigs()
    lm_configs.set_conv_simulator_lm(
        LitellmModel(
            model=model_name, max_tokens=token_limits["conv_simulator"], **llm_kwargs
        )
    )
    lm_configs.set_question_asker_lm(
        LitellmModel(
            model=model_name, max_tokens=token_limits["question_asker"], **llm_kwargs
        )
    )
    lm_configs.set_outline_gen_lm(
        LitellmModel(
            model=model_name, max_tokens=token_limits["outline_gen"], **llm_kwargs
        )
    )
    lm_configs.set_article_gen_lm(
        LitellmModel(
            model=model_name, max_tokens=token_limits["article_gen"], **llm_kwargs
        )
    )
    lm_configs.set_article_polish_lm(
        LitellmModel(
            model=model_name, max_tokens=token_limits["article_polish"], **llm_kwargs
        )
    )
    return lm_configs


def _build_paper_retriever(args):
    if args.retriever == "arxiv":
        return ArxivRM(k=args.search_top_k)
    if args.retriever == "local-pdf":
        if not args.pdf_dir:
            raise ValueError("--pdf-dir is required when retriever is local-pdf")
        return LocalPDFRM(pdf_dir=args.pdf_dir, k=args.search_top_k)
    raise ValueError(f"Unsupported retriever: {args.retriever}")


def _write_pipeline_scorecard(config):
    case = EvalCase(
        topic=config.topic,
        expected_keywords=list(config.expected_keywords),
        forbidden_keywords=list(config.forbidden_keywords),
        expected_language=config.output_language,
        min_sources=1,
    )
    output_dir = Path(config.article_dir)
    scorecard = evaluate_run(output_dir, case)
    write_scorecards(output_dir, scorecard)
    (output_dir / "pipeline_worker.json").write_text(
        json.dumps(
            {
                "runner": "paperstorm",
                "retriever": config.retriever,
                "llm_provider": config.llm_provider,
                "llm_model": config.llm_model,
                "score": scorecard["scores"]["total"],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
