from setuptools import setup, find_packages

# Read the version from knowledge_storm/__init__.py
version = {}
with open("knowledge_storm/__init__.py") as f:
    for line in f:
        if line.startswith("__version__"):
            exec(line, version)
            break

# Read README for long description
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="knowledge-storm",
    version=version.get("__version__", "0.0.0"),
    author="Yijia Shao, Yucheng Jiang",
    author_email="shaoyj@stanford.edu",
    description="STORM: Synthesis of Topic Outlines through Retrieval and Multi-perspective question asking",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/stanford-oval/storm",
    # Explicitly specify packages to include
    packages=find_packages(include=["knowledge_storm", "knowledge_storm.*"]),
    package_dir={"": "."},
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Build Tools",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.11",
    install_requires=[
        "dspy-ai>=2.5.29",
        "qdrant-client>=1.12.1",
        "litellm>=1.58.4",
        "langchain>=0.2.16",
        "langchain-qdrant>=0.2.0",
        "langchain-huggingface>=0.1.2",
        "langchain-text-splitters>=0.3.2",
        "sentence-transformers>=3.0.1",
        "rank-bm25>=0.2.2",
        "tqdm>=4.66.6",
        "wikipedia>=1.4.0",
        "numpy>=1.26.4",
        "scipy>=1.14.1",
        "scikit-learn>=1.5.1",
        "pyvis>=0.3.2",
        "pandas>=2.2.2",
        "python-dateutil>=2.9.0",
        "torch>=2.4.0",
        "transformers>=4.44.0",
        "tokenizers>=0.19.1",
        "huggingface-hub>=0.24.5",
        "packaging>=24.1",
        "tenacity>=9.0.0",
        "python-multipart==0.0.18",
        "PyJWT==2.10.1",
        "cryptography==44.0.1",
        "markdown2>=2.5.4",
        "black==24.3.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "pytest-asyncio>=0.21.1",
            "mypy>=1.4.1",
            "pre-commit>=3.3.3",
        ],
        "ui": [
            "streamlit>=1.39.0",
            "streamlit-authenticator==0.3.3",
            "streamlit-float==0.3.5",
            "toml>=0.10.2",
        ],
    },
    keywords="information retrieval, RAG, grounding, long-form generation, knowledge curation",
    project_urls={
        "Bug Tracker": "https://github.com/stanford-oval/storm/issues",
    },
)