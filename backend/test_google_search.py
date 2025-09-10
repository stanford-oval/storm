#!/usr/bin/env python3
"""
Test script to verify Google Search integration in STORM backend.
"""

import requests
import json
from datetime import datetime


def test_google_search():
    """Test creating a project with Google Search retriever."""

    base_url = "http://localhost:8000"

    # Check health
    response = requests.get(f"{base_url}/api/health")
    print(f"✓ Backend health: {response.json()}")

    # Create project with Google retriever
    project_data = {
        "topic": f"Google Search Test - {datetime.now().strftime('%H:%M:%S')}",
        "title": "Testing Google Search Integration",
        "config": {
            "retriever_type": "google",
            "max_search_results": 5,
            "llm_model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_tokens": 1024,
            "do_research": True,
            "do_generate_outline": False,
            "do_generate_article": False,
            "do_polish_article": False,
        },
    }

    print("\n📝 Creating project with Google Search retriever...")
    response = requests.post(f"{base_url}/api/projects", json=project_data)

    if response.status_code == 200:
        project = response.json()
        print(f"✓ Project created successfully!")
        print(f"  ID: {project.get('id')}")
        print(f"  Topic: {project.get('topic')}")
        print(f"  Retriever: {project.get('config', {}).get('retriever_type')}")
        return project
    else:
        print(f"✗ Failed to create project: {response.status_code}")
        print(f"  Response: {response.text}")
        return None


def test_available_retrievers():
    """Check which retrievers are available."""

    # Try to import the retrievers to see what's available
    print("\n🔍 Checking available retrievers...")

    available = []

    try:
        from knowledge_storm.rm import GoogleSearch
        import os

        if os.getenv("GOOGLE_SEARCH_API_KEY") and os.getenv("GOOGLE_CSE_ID"):
            available.append("✓ Google Search (API key and CSE ID configured)")
        else:
            available.append(
                "○ Google Search (needs GOOGLE_SEARCH_API_KEY and GOOGLE_CSE_ID)"
            )
    except ImportError:
        available.append("✗ Google Search (not installed)")

    try:
        from knowledge_storm.rm import SerperRM
        import os

        if os.getenv("SERPER_API_KEY"):
            available.append("✓ Serper (API key configured)")
        else:
            available.append("○ Serper (needs SERPER_API_KEY)")
    except ImportError:
        available.append("✗ Serper (not installed)")

    try:
        from knowledge_storm.rm import TavilySearchRM
        import os

        if os.getenv("NEXT_PUBLIC_TAVILY_API_KEY"):
            available.append("✓ Tavily (API key configured)")
        else:
            available.append("○ Tavily (needs NEXT_PUBLIC_TAVILY_API_KEY)")
    except ImportError:
        available.append("✗ Tavily (not installed)")

    try:
        from knowledge_storm.rm import DuckDuckGoSearchRM

        available.append("✓ DuckDuckGo (no API key needed)")
    except ImportError:
        available.append("✗ DuckDuckGo (not installed)")

    for status in available:
        print(f"  {status}")


if __name__ == "__main__":
    print("=" * 60)
    print("STORM Google Search Integration Test")
    print("=" * 60)

    test_available_retrievers()
    project = test_google_search()

    if project:
        print(f"\n✅ Google Search integration is ready!")
        print(f"\nTo use Google Search:")
        print(f"1. Add GOOGLE_SEARCH_API_KEY to backend/.env")
        print(f"2. Add GOOGLE_CSE_ID to backend/.env")
        print(f"3. Select 'Google Search' in the UI configuration panel")

    print("\n" + "=" * 60)
