# Build stage
FROM python:3.11-slim-bullseye AS builder

WORKDIR /app

# Copy only requirements.txt first to leverage Docker cache
COPY requirements.txt .

# Install build dependencies and Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Final stage
FROM python:3.11-slim-bullseye

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application files
COPY . .

# Create necessary directories and files
RUN mkdir -p .streamlit && touch .streamlit/secrets.toml

# Expose the port (will be overridden by docker-compose)
EXPOSE 8501

# Set environment variables with default values
ENV STREAMLIT_OUTPUT_DIR=/app/DEMO_WORKING_DIR
ENV STORM_TIMEZONE="America/Los_Angeles"
ENV PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"
ENV SEARXNG_BASE_URL="http://localhost:8080"
ENV PORT=8501
ENV DB_PATH=/db/settings.db

# Run the application
CMD streamlit run storm.py --server.port $PORT --server.address 0.0.0.0
