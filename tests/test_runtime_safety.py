import ast
import pathlib
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_source(relative_path):
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def find_class(module, class_name):
    for node in module.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    raise AssertionError(f"{class_name} not found")


def find_function(class_node, function_name):
    for node in class_node.body:
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return node
    raise AssertionError(f"{class_node.name}.{function_name} not found")


class RuntimeSafetyTests(unittest.TestCase):
    def test_file_io_helpers_use_utf8_defaults(self):
        source = read_source("knowledge_storm/utils.py")
        module = ast.parse(source)
        helper = find_class(module, "FileIOHelper")

        for function_name in ("write_str", "load_str"):
            function = find_function(helper, function_name)
            defaults = {
                arg.arg: default.value
                for arg, default in zip(
                    function.args.args[-len(function.args.defaults) :],
                    function.args.defaults,
                )
                if isinstance(default, ast.Constant)
            }
            self.assertEqual(defaults.get("encoding"), "utf-8")

        self.assertIn('open(path, "w", encoding=encoding)', source)
        self.assertIn('open(path, "r", encoding=encoding)', source)

    def test_webpage_helper_verifies_tls_by_default(self):
        source = read_source("knowledge_storm/utils.py")
        module = ast.parse(source)
        helper = find_class(module, "WebPageHelper")
        init = find_function(helper, "__init__")
        defaults = {
            arg.arg: default.value
            for arg, default in zip(
                init.args.args[-len(init.args.defaults) :],
                init.args.defaults,
            )
            if isinstance(default, ast.Constant)
        }

        self.assertIs(defaults.get("verify_ssl"), True)
        self.assertEqual(defaults.get("request_timeout"), 4.0)
        self.assertIn("httpx.Client(verify=verify_ssl)", source)
        self.assertIn("timeout=self.request_timeout", source)


if __name__ == "__main__":
    unittest.main()
