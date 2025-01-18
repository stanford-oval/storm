# Base image
FROM python:3.9-slim-bullseye

# ARG to set the environment (default: production)
ARG ENVIRONMENT=dev

# Create a non-root user and group
RUN groupadd -r streamlit && useradd --no-log-init -r -g streamlit streamlit

# Install runtime dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    libpq-dev \
    software-properties-common \
    # virtualenv \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV VIRTUAL_ENV=/home/streamlit/venv

# Create a working directory
WORKDIR /home/streamlit

ADD frontend/demo_light/ /home/streamlit/app

RUN pip install --no-cache -r app/requirements.txt


COPY frontend/demo_light/run.sh /home/streamlit
COPY frontend/demo_light/.streamlit/secrets.toml /home/streamlit/.streamlit/secrets.toml
COPY frontend/demo_light/.streamlit/config.toml /home/streamlit/.streamlit/config.toml

# Set ownership to the non-root user
RUN chown -R streamlit:streamlit /home/streamlit

# Make the entrypoint script executable
RUN chmod +x /home/streamlit/run.sh

USER streamlit

EXPOSE 8501

ENTRYPOINT ["./run.sh"]