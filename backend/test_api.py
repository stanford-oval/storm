#!/usr/bin/env python3
"""
Simple test script for STORM UI Backend API.

Tests basic functionality without requiring external dependencies.
"""

import requests
import json
import time
import sys
from typing import Optional


class APITester:
    """Simple API testing class."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.created_project_id: Optional[str] = None

    def test_health(self) -> bool:
        """Test health endpoint."""
        print("Testing health endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/api/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health check passed: {data}")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False

    def test_create_project(self) -> bool:
        """Test project creation."""
        print("\nTesting project creation...")
        try:
            payload = {
                "title": "Test Project",
                "topic": "Artificial Intelligence and Machine Learning",
            }

            response = self.session.post(
                f"{self.base_url}/api/projects/",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                self.created_project_id = data["id"]
                print(f"✅ Project created: {data['title']} (ID: {data['id']})")
                return True
            else:
                print(
                    f"❌ Project creation failed: {response.status_code} - {response.text}"
                )
                return False
        except Exception as e:
            print(f"❌ Project creation error: {e}")
            return False

    def test_list_projects(self) -> bool:
        """Test listing projects."""
        print("\nTesting project listing...")
        try:
            response = self.session.get(f"{self.base_url}/api/projects/")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Projects listed: {len(data)} projects found")
                if data and self.created_project_id:
                    found = any(p["id"] == self.created_project_id for p in data)
                    if found:
                        print("✅ Created project found in list")
                    else:
                        print("⚠️ Created project not found in list")
                return True
            else:
                print(f"❌ Project listing failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Project listing error: {e}")
            return False

    def test_get_project(self) -> bool:
        """Test getting specific project."""
        if not self.created_project_id:
            print("\n⚠️ Skipping project get test - no project created")
            return True

        print(f"\nTesting project retrieval for ID: {self.created_project_id}")
        try:
            response = self.session.get(
                f"{self.base_url}/api/projects/{self.created_project_id}"
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Project retrieved: {data['title']}")
                print(f"   Content preview: {data['content'][:100]}...")
                return True
            else:
                print(f"❌ Project retrieval failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Project retrieval error: {e}")
            return False

    def test_pipeline_status(self) -> bool:
        """Test pipeline status endpoint."""
        if not self.created_project_id:
            print("\n⚠️ Skipping pipeline status test - no project created")
            return True

        print(f"\nTesting pipeline status for ID: {self.created_project_id}")
        try:
            response = self.session.get(
                f"{self.base_url}/api/pipeline/{self.created_project_id}/status"
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Pipeline status retrieved: {data['progress']['status']}")
                return True
            else:
                print(f"❌ Pipeline status failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Pipeline status error: {e}")
            return False

    def test_mock_pipeline(self) -> bool:
        """Test mock pipeline execution."""
        if not self.created_project_id:
            print("\n⚠️ Skipping mock pipeline test - no project created")
            return True

        print(f"\nTesting mock pipeline for ID: {self.created_project_id}")
        try:
            payload = {"mock_mode": True}
            response = self.session.post(
                f"{self.base_url}/api/pipeline/{self.created_project_id}/run",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Mock pipeline started: {data['message']}")

                # Wait a bit and check status
                print("   Waiting for pipeline progress...")
                time.sleep(3)

                status_response = self.session.get(
                    f"{self.base_url}/api/pipeline/{self.created_project_id}/status"
                )
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    progress = status_data["progress"]
                    print(
                        f"   Pipeline progress: {progress['overall_progress']:.1f}% - {progress['current_task']}"
                    )

                return True
            else:
                print(
                    f"❌ Mock pipeline failed: {response.status_code} - {response.text}"
                )
                return False
        except Exception as e:
            print(f"❌ Mock pipeline error: {e}")
            return False

    def test_update_project(self) -> bool:
        """Test project update."""
        if not self.created_project_id:
            print("\n⚠️ Skipping project update test - no project created")
            return True

        print(f"\nTesting project update for ID: {self.created_project_id}")
        try:
            payload = {
                "content": "# Updated Test Project\n\nThis project has been updated via API test.",
                "status": "completed",
            }

            response = self.session.put(
                f"{self.base_url}/api/projects/{self.created_project_id}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Project updated: status = {data['status']}")
                return True
            else:
                print(f"❌ Project update failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Project update error: {e}")
            return False

    def test_project_stats(self) -> bool:
        """Test project statistics."""
        print("\nTesting project statistics...")
        try:
            response = self.session.get(f"{self.base_url}/api/projects/stats/summary")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ Project stats retrieved:")
                print(f"   Total projects: {data['total_projects']}")
                print(f"   Total words: {data['total_words']}")
                print(f"   Projects by status: {data['projects_by_status']}")
                return True
            else:
                print(f"❌ Project stats failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Project stats error: {e}")
            return False

    def test_cleanup(self) -> bool:
        """Clean up test data."""
        if not self.created_project_id:
            print("\n⚠️ No cleanup needed - no project created")
            return True

        print(f"\nCleaning up test project ID: {self.created_project_id}")
        try:
            response = self.session.delete(
                f"{self.base_url}/api/projects/{self.created_project_id}"
            )

            if response.status_code == 200:
                print("✅ Test project deleted successfully")
                return True
            else:
                print(
                    f"⚠️ Cleanup failed: {response.status_code} (project may still exist)"
                )
                return False
        except Exception as e:
            print(f"⚠️ Cleanup error: {e}")
            return False

    def run_all_tests(self, cleanup: bool = True) -> bool:
        """Run all tests."""
        print("🧪 Starting STORM UI Backend API Tests")
        print("=" * 50)

        tests = [
            ("Health Check", self.test_health),
            ("Create Project", self.test_create_project),
            ("List Projects", self.test_list_projects),
            ("Get Project", self.test_get_project),
            ("Pipeline Status", self.test_pipeline_status),
            ("Mock Pipeline", self.test_mock_pipeline),
            ("Update Project", self.test_update_project),
            ("Project Stats", self.test_project_stats),
        ]

        if cleanup:
            tests.append(("Cleanup", self.test_cleanup))

        passed = 0
        total = len(tests)

        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except KeyboardInterrupt:
                print("\n\n⚠️ Tests interrupted by user")
                break
            except Exception as e:
                print(f"❌ Unexpected error in {test_name}: {e}")

        print("\n" + "=" * 50)
        print(f"🧪 Test Results: {passed}/{total} tests passed")

        if passed == total:
            print("✅ All tests passed! Backend is working correctly.")
            return True
        else:
            print("❌ Some tests failed. Check the output above for details.")
            return False


def main():
    """Main test runner."""
    import argparse

    parser = argparse.ArgumentParser(description="Test STORM UI Backend API")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument(
        "--no-cleanup", action="store_true", help="Don't delete test project"
    )
    args = parser.parse_args()

    tester = APITester(args.url)
    success = tester.run_all_tests(cleanup=not args.no_cleanup)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
