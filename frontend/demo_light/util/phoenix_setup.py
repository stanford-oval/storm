import os
from phoenix import trace
from phoenix.trace.openai import OpenAIInstrumentor
from openinference.semconv.resource import ResourceAttributes
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor


def setup_phoenix():
    """
    Set up Phoenix for tracing and instrumentation.
    """
    resource = Resource(
        attributes={
            ResourceAttributes.PROJECT_NAME: "storm-wiki"})
    tracer_provider = trace_sdk.TracerProvider(resource=resource)

    phoenix_collector_endpoint = os.getenv(
        "PHOENIX_COLLECTOR_ENDPOINT", "localhost:6006"
    )
    span_exporter = OTLPSpanExporter(
        endpoint=f"http://{phoenix_collector_endpoint}/v1/traces"
    )

    span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
    tracer_provider.add_span_processor(span_processor=span_processor)
    trace_api.set_tracer_provider(tracer_provider=tracer_provider)

    OpenAIInstrumentor().instrument()

    # Return the tracer provider in case it's needed elsewhere
    return tracer_provider
