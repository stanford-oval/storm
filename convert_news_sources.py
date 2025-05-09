#!/usr/bin/env python
"""
Converts a dataset with seed article and related articles to STORM-compatible format.

Usage:
  python convert_news_sources.py input_file.json output_file.json
"""

import json
import sys
import os
from typing import List, Dict, Any

def process_text_to_snippets(text: str, max_snippets: int = 5, max_length: int = 500) -> List[str]:
    """
    Splits text into meaningful snippets for STORM.
    
    Args:
        text: The text content to split
        max_snippets: Maximum number of snippets to generate
        max_length: Maximum length of each snippet in characters
        
    Returns:
        List of string snippets
    """
    # If text is empty or None, return empty list
    if not text:
        return []
        
    # If text is already an array, process each item
    if isinstance(text, list):
        processed = []
        for item in text[:max_snippets]:
            if isinstance(item, str) and item.strip():
                # Limit each item's length
                processed.append(item[:max_length].strip())
        return processed
        
    # Try to split by paragraphs
    paragraphs = [p.strip()[:max_length] for p in text.split("\n\n") if p.strip()]
    
    # If we have multiple paragraphs, use them
    if len(paragraphs) > 1:
        return paragraphs[:max_snippets]
    
    # Otherwise split into chunks of ~100 words (safer than 200)
    words = text.split()
    if len(words) <= 100:
        return [text[:max_length]]
        
    chunks = []
    for i in range(0, len(words), 100):
        chunk = " ".join(words[i:i+100])
        chunks.append(chunk[:max_length])
    
    return chunks[:max_snippets]

def sanitize_input(data):
    """
    Sanitizes input data by removing problematic fields or values that could cause memory issues.
    
    Args:
        data: The data to sanitize
        
    Returns:
        Sanitized data
    """
    if isinstance(data, dict):
        # Process dict recursively
        result = {}
        for key, value in data.items():
            # Skip very large values
            if isinstance(value, str) and len(value) > 10000:
                # Truncate extremely long strings
                result[key] = value[:10000] + "... [truncated]"
            elif key in ["html", "full_html", "raw_html"]:
                # Skip HTML content as it's not needed and can be large
                result[key] = "[html content removed]"
            else:
                result[key] = sanitize_input(value)
        return result
    elif isinstance(data, list):
        # Process list recursively
        return [sanitize_input(item) for item in data]
    else:
        # Return primitive values unchanged
        return data

def convert_to_storm_format(input_file: str, output_file: str) -> None:
    """
    Converts a news dataset to STORM format.
    
    Args:
        input_file: Path to the input JSON file
        output_file: Path to save the output JSON file
    """
    # Load the data
    with open(input_file, 'r', encoding='utf-8') as f:
        try:
            raw_data = json.load(f)
            # Sanitize input data to prevent memory issues
            data = sanitize_input(raw_data)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            sys.exit(1)
    
    formatted_sources = []
    
    # Process the seed article
    if "seed" in data:
        seed = data["seed"]
        # Always use english_text if available
        seed_content = seed.get("english_text", seed.get("text", ""))
        
        # Create snippets from the content
        snippets = process_text_to_snippets(seed_content, max_snippets=3)
        
        # Skip if no valid content
        if not snippets:
            print("Warning: No valid content found in seed article")
        else:
            source_info = {
                "url": seed.get("url", "https://example.com/seed"),
                "description": seed.get("description", f"Seed article about {seed.get('title', 'the topic')}")[:200],
                "snippets": snippets,
                "title": seed.get("title", "Seed Article")[:100],
                "metadata": {
                    "source": seed.get("source", "Primary Source")[:50],
                    "date": seed.get("date", seed.get("published_date", ""))[:20],
                    "author": seed.get("author", "")[:50],
                    "country": seed.get("country", "")[:30],
                    "language": seed.get("language", "english")[:20],
                    "is_seed": True
                }
            }
            formatted_sources.append(source_info)
    
    # Process additional articles
    if "articles" in data:
        for idx, article in enumerate(data["articles"]):
            # Limit to processing 10 articles to avoid memory issues
            if idx >= 10:
                print(f"Limiting to 10 articles (skipping {len(data['articles']) - 10} more)")
                break
                
            # Always use english_text if available
            article_content = article.get("english_text", article.get("text", ""))
            
            # Create snippets from the content
            snippets = process_text_to_snippets(article_content, max_snippets=2)
            
            if not snippets:
                print(f"Warning: No content found for article {idx}")
                continue
                
            source_info = {
                "url": article.get("url", f"https://example.com/article{idx+1}"),
                "description": article.get("description", f"Related article {idx+1}")[:200],
                "snippets": snippets,
                "title": article.get("title", f"Article {idx+1}")[:100],
                "metadata": {
                    "source": article.get("source", "Related Source")[:50],
                    "date": article.get("date", article.get("published_date", ""))[:20],
                    "author": article.get("author", "")[:50],
                    "country": article.get("country", "")[:30],
                    "language": article.get("language", "english")[:20]
                }
            }
            formatted_sources.append(source_info)
    
    # Limit total sources to avoid memory issues
    if len(formatted_sources) > 10:
        formatted_sources = formatted_sources[:10]
        print(f"Limiting to 10 total sources to prevent memory issues")
    
    # Save the formatted sources
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(formatted_sources, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Converted {len(formatted_sources)} articles to STORM format at {output_file}")
    print(f"📝 The data has been sanitized to prevent memory issues")
    
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} input_file.json output_file.json")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)
        
    convert_to_storm_format(input_file, output_file) 