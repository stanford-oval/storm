import os
import shutil
import json


def convert_txt_to_md(directory):
    """
    Recursively walks through the given directory and converts all .txt files
    containing 'storm_gen_article' in their name to .md files.

    Args:
    directory (str): The path to the directory to process.
    """
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".txt") and "storm_gen_article" in file:
                txt_path = os.path.join(root, file)
                md_path = txt_path.rsplit(".", 1)[0] + ".md"
                shutil.move(txt_path, md_path)
                print(f"Converted {txt_path} to {md_path}")


def clean_artifacts(directory):
    """
    Removes temporary or unnecessary artifact files from the given directory.

    Args:
    directory (str): The path to the directory to clean.
    """
    temp_extensions = [".tmp", ".bak", ".cache"]
    removed_files = []

    for root, dirs, files in os.walk(directory):
        for file in files:
            if any(file.endswith(ext) for ext in temp_extensions):
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                    removed_files.append(file_path)
                except Exception as e:
                    print(f"Error removing {file_path}: {str(e)}")

    if removed_files:
        print(f"Cleaned {len(removed_files)} temporary files:")
        for file in removed_files:
            print(f"  - {file}")
    else:
        print("No temporary files found to clean.")


def validate_artifacts(directory):
    """
    Checks if all necessary artifact files are present and valid in the given directory.

    Args:
    directory (str): The path to the directory to validate.

    Returns:
    bool: True if all artifacts are valid, False otherwise.
    """
    required_files = [
        "storm_gen_article.md",
        "storm_gen_article_polished.md",
        "conversation_log.json",
        "url_to_info.json",
    ]

    missing_files = []
    invalid_files = []

    for root, dirs, files in os.walk(directory):
        for required_file in required_files:
            file_path = os.path.join(root, required_file)
            if not os.path.exists(file_path):
                missing_files.append(file_path)
            elif required_file.endswith(".json"):
                try:
                    with open(file_path, "r") as f:
                        json.load(f)
                except json.JSONDecodeError:
                    invalid_files.append(file_path)

    if missing_files:
        print("Missing required files:")
        for file in missing_files:
            print(f"  - {file}")

    if invalid_files:
        print("Invalid JSON files:")
        for file in invalid_files:
            print(f"  - {file}")

    is_valid = not (missing_files or invalid_files)

    if is_valid:
        print("All artifacts are present and valid.")
    else:
        print("Artifact validation failed.")

    return is_valid


# Additional helper function to manage artifacts
def list_artifacts(directory):
    """
    Lists all artifact files in the given directory.

    Args:
    directory (str): The path to the directory to list artifacts from.

    Returns:
    dict: A dictionary with artifact types as keys and lists of file paths as values.
    """
    artifacts = {"articles": [], "logs": [], "data": []}

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            if file.endswith(".md") and "storm_gen_article" in file:
                artifacts["articles"].append(file_path)
            elif file.endswith(".json"):
                if file == "conversation_log.json":
                    artifacts["logs"].append(file_path)
                else:
                    artifacts["data"].append(file_path)

    return artifacts
