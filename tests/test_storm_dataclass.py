from knowledge_storm.storm_wiki.modules.storm_dataclass import StormInformationTable


def test_retrieve_information_with_no_snippets():
    table = StormInformationTable.__new__(StormInformationTable)
    table.collected_snippets = []

    assert table.retrieve_information("query", search_top_k=5) == []


if __name__ == "__main__":
    test_retrieve_information_with_no_snippets()
