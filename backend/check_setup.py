#!/usr/bin/env python3
"""
Setup verification script for STORM UI Backend.

Checks dependencies, configurations, and provides setup guidance.
"""

import os
import sys
import importlib
from pathlib import Path
from typing import List, Tuple, Optional


class SetupChecker:
    """Checks backend setup and provides guidance."""

    def __init__(self):
        self.backend_dir = Path(__file__).parent
        self.storm_root = self.backend_dir.parent
        self.issues: List[str] = []
        self.warnings: List[str] = []

    def check_python_version(self) -> bool:
        """Check Python version compatibility."""
        version = sys.version_info
        print(f"🐍 Python Version: {version.major}.{version.minor}.{version.micro}")

        if version.major == 3 and version.minor >= 8:
            print("✅ Python version is compatible")
            return True
        else:
            self.issues.append("Python 3.8+ required")
            print("❌ Python version is too old (3.8+ required)")
            return False

    def check_dependencies(self) -> bool:
        """Check required Python packages."""
        print("\n📦 Checking Dependencies:")

        required_packages = [
            ("fastapi", "FastAPI web framework"),
            ("uvicorn", "ASGI server"),
            ("pydantic", "Data validation"),
            ("python-frontmatter", "Markdown frontmatter parsing"),
            ("aiofiles", "Async file operations"),
        ]

        optional_packages = [
            ("knowledge_storm", "STORM core package"),
            ("requests", "HTTP client (for testing)"),
        ]

        all_good = True

        for package, description in required_packages:
            if self._check_package(package, description, required=True):
                print(f"✅ {package} - {description}")
            else:
                all_good = False
                print(f"❌ {package} - {description}")

        print("\nOptional packages:")
        for package, description in optional_packages:
            if self._check_package(package, description, required=False):
                print(f"✅ {package} - {description}")
            else:
                print(f"⚠️  {package} - {description} (optional)")

        return all_good

    def _check_package(
        self, package: str, description: str, required: bool = True
    ) -> bool:
        """Check if a package is available."""
        try:
            importlib.import_module(package)
            return True
        except ImportError:
            if required:
                self.issues.append(f"Missing required package: {package}")
            else:
                self.warnings.append(f"Missing optional package: {package}")
            return False

    def check_file_structure(self) -> bool:
        """Check backend file structure."""
        print("\n📁 Checking File Structure:")

        required_files = [
            "main.py",
            "requirements.txt",
            "services/__init__.py",
            "services/file_service.py",
            "services/storm_runner.py",
            "routers/__init__.py",
            "routers/projects.py",
            "routers/pipeline.py",
        ]

        all_good = True

        for file_path in required_files:
            full_path = self.backend_dir / file_path
            if full_path.exists():
                print(f"✅ {file_path}")
            else:
                all_good = False
                self.issues.append(f"Missing file: {file_path}")
                print(f"❌ {file_path}")

        return all_good

    def check_storm_integration(self) -> bool:
        """Check STORM package integration."""
        print("\n⛈️  Checking STORM Integration:")

        try:
            import knowledge_storm

            version = getattr(knowledge_storm, "__version__", "unknown")
            print(f"✅ STORM package found (version: {version})")

            # Try importing key classes
            try:
                from knowledge_storm import STORMWikiRunner, STORMWikiLMConfigs

                print("✅ STORM classes can be imported")
                return True
            except ImportError as e:
                self.warnings.append(f"STORM import issue: {e}")
                print(f"⚠️  STORM classes import issue: {e}")
                return False

        except ImportError:
            self.warnings.append("STORM package not installed")
            print("⚠️  STORM package not installed - pipeline features will be limited")
            return False

    def check_api_keys(self) -> bool:
        """Check API key configuration."""
        print("\n🔑 Checking API Key Configuration:")

        api_keys = [
            ("OPENAI_API_KEY", "OpenAI API", False),
            ("ANTHROPIC_API_KEY", "Anthropic API", False),
            ("BING_SEARCH_API_KEY", "Bing Search API", False),
            ("YDC_API_KEY", "You.com API", False),
            ("TAVILY_API_KEY", "Tavily API", False),
        ]

        any_configured = False

        for key, name, required in api_keys:
            if os.getenv(key):
                print(f"✅ {name} configured")
                any_configured = True
            else:
                status = "❌" if required else "⚠️ "
                print(f"{status} {name} not configured")
                if required:
                    self.issues.append(f"Missing required API key: {key}")

        if not any_configured:
            self.warnings.append("No API keys configured - some features may not work")

        return True  # API keys are optional for basic functionality

    def check_storage_setup(self) -> bool:
        """Check storage directory setup."""
        print("\n💾 Checking Storage Setup:")

        storage_path = self.storm_root / "storm-projects"

        try:
            storage_path.mkdir(exist_ok=True)
            projects_dir = storage_path / "projects"
            projects_dir.mkdir(exist_ok=True)

            # Test write permissions
            test_file = storage_path / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()

            print(f"✅ Storage directory ready: {storage_path}")
            print(f"✅ Write permissions OK")
            return True

        except PermissionError:
            self.issues.append(f"No write permission for: {storage_path}")
            print(f"❌ No write permission for: {storage_path}")
            return False
        except Exception as e:
            self.issues.append(f"Storage setup error: {e}")
            print(f"❌ Storage setup error: {e}")
            return False

    def provide_setup_guidance(self):
        """Provide setup guidance based on issues found."""
        if not self.issues and not self.warnings:
            print("\n🎉 Setup Check Complete: Everything looks good!")
            print("\nNext steps:")
            print("1. Start the backend: python start.py")
            print("2. Test the API: python test_api.py")
            print("3. View API docs: http://localhost:8000/api/docs")
            return

        print("\n🔧 Setup Guidance:")

        if self.issues:
            print("\n❌ Issues that need to be resolved:")
            for issue in self.issues:
                print(f"   • {issue}")

            print("\n💡 Resolution steps:")
            print("   1. Install dependencies: pip install -r requirements.txt")
            print("   2. Install STORM: pip install -e ../  (from storm root)")
            print("   3. Check file permissions for storage directory")

        if self.warnings:
            print("\n⚠️  Warnings (optional improvements):")
            for warning in self.warnings:
                print(f"   • {warning}")

            print("\n💡 Optional improvements:")
            print("   1. Install STORM package for full pipeline functionality")
            print("   2. Configure API keys in .env file for external services")
            print("   3. Copy .env.template to .env and fill in your keys")

    def run_all_checks(self) -> bool:
        """Run all setup checks."""
        print("🔍 STORM UI Backend Setup Check")
        print("=" * 40)

        checks = [
            ("Python Version", self.check_python_version),
            ("Dependencies", self.check_dependencies),
            ("File Structure", self.check_file_structure),
            ("STORM Integration", self.check_storm_integration),
            ("API Keys", self.check_api_keys),
            ("Storage Setup", self.check_storage_setup),
        ]

        results = []
        for check_name, check_func in checks:
            try:
                result = check_func()
                results.append(result)
            except Exception as e:
                print(f"❌ {check_name} check failed: {e}")
                results.append(False)

        all_passed = all(results)
        critical_passed = (
            results[0] and results[1] and results[2] and results[5]
        )  # Critical checks

        print("\n" + "=" * 40)
        print(f"Setup Status: {'✅ Ready' if critical_passed else '❌ Issues Found'}")

        self.provide_setup_guidance()

        return all_passed


def main():
    """Main setup checker."""
    checker = SetupChecker()
    success = checker.run_all_checks()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
