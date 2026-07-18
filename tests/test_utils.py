from knowledge_storm.utils import truncate_filename


def test_truncate_filename_preserves_extension_when_possible():
    filename = "a" * 20 + ".json"

    assert truncate_filename(filename, max_length=12) == "a" * 7 + ".json"


def test_truncate_filename_without_extension_keeps_existing_behavior():
    assert truncate_filename("abcdef", max_length=4) == "abcd"
