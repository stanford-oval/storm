import os
from phoenix import trace
from phoenix.trace.openai import OpenAIInstrumentor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from db.db_operations import load_setting


def setup_phoenix():
    """
    Set up Phoenix for tracing and instrumentation.
    """
    phoenix_settings = load_setting(
        "phoenix_settings",
        {
            "project_name": "storm-wiki",
            "enabled": False,
            "collector_endpoint": "localhost:6006",
        },
    )

    if not phoenix_settings.get("enabled", False):
        return None

    resource = Resource(
        attributes={
            ResourceAttributes.PROJECT_NAME: phoenix_settings.get(
                "project_name", "storm-wiki"
            )
        }
    )
    tracer_provider = trace_sdk.TracerProvider(resource=resource)

    span_exporter = OTLPSpanExporter(
        endpoint=f"http://{phoenix_settings.get('collector_endpoint', 'localhost:6006')}/v1/traces"
    )

    span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
    tracer_provider.add_span_processor(span_processor=span_processor)
    trace_api.set_tracer_provider(tracer_provider=tracer_provider)

    OpenAIInstrumentor().instrument()

    return tracer_provider
