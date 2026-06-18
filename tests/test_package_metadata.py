import pathlib
import re
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_source(relative_path):
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class PackageMetadataTests(unittest.TestCase):
    def test_package_version_matches_setup_metadata(self):
        setup_source = read_source("setup.py")
        init_source = read_source("knowledge_storm/__init__.py")

        setup_version = re.search(r'version="([^"]+)"', setup_source)
        init_version = re.search(r'__version__ = "([^"]+)"', init_source)

        self.assertIsNotNone(setup_version)
        self.assertIsNotNone(init_version)
        self.assertEqual(setup_version.group(1), init_version.group(1))


if __name__ == "__main__":
    unittest.main()
