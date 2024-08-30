from typing import Union, List
from urllib.parse import urlparse

import dspy

from .storm_dataclass import StormInformation
from ...interface import Retriever, Information
from ...utils import ArticleTextProcessing

# Internet source restrictions according to Wikipedia standard:
# https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources/Perennial_sources
GENERALLY_UNRELIABLE = {
    "112_Ukraine",
    "Ad_Fontes_Media",
    "AlterNet",
    "Amazon",
    "Anadolu_Agency_(controversial_topics)",
    "Ancestry.com",
    "Answers.com",
    "Antiwar.com",
    "Anti-Defamation_League",
    "arXiv",
    "Atlas_Obscura_places",
    "Bild",
    "Blaze_Media",
    "Blogger",
    "BroadwayWorld",
    "California_Globe",
    "The_Canary",
    "CelebrityNetWorth",
    "CESNUR",
    "ChatGPT",
    "CNET_(November_2022\u2013present)",
    "CoinDesk",
    "Consortium_News",
    "CounterPunch",
    "Correo_del_Orinoco",
    "Cracked.com",
    "Daily_Express",
    "Daily_Kos",
    "Daily_Sabah",
    "The_Daily_Wire",
    "Discogs",
    "Distractify",
    "The_Electronic_Intifada",
    "Encyclopaedia_Metallum",
    "Ethnicity_of_Celebs",
    "Facebook",
    "FamilySearch",
    "Fandom",
    "The_Federalist",
    "Find_a_Grave",
    "Findmypast",
    "Flags_of_the_World",
    "Flickr",
    "Forbes.com_contributors",
    "Fox_News_(politics_and_science)",
    "Fox_News_(talk_shows)",
    "Gawker",
    "GB_News",
    "Geni.com",
    "gnis-class",
    "gns-class",
    "GlobalSecurity.org",
    "Goodreads",
    "Guido_Fawkes",
    "Heat_Street",
    "History",
    "HuffPost_contributors",
    "IMDb",
    "Independent_Media_Center",
    "Inquisitr",
    "International_Business_Times",
    "Investopedia",
    "Jewish_Virtual_Library",
    "Joshua_Project",
    "Know_Your_Meme",
    "Land_Transport_Guru",
    "LinkedIn",
    "LiveJournal",
    "Marquis_Who's_Who",
    "Mashable_sponsored_content",
    "MEAWW",
    "Media_Bias/Fact_Check",
    "Media_Research_Center",
    "Medium",
    "metal-experience",
    "Metro",
    "The_New_American",
    "New_York_Post",
    "NGO_Monitor",
    "The_Onion",
    "Our_Campaigns",
    "PanAm_Post",
    "Patheos",
    "An_Phoblacht",
    "The_Post_Millennial",
    "arXiv",
    "bioRxiv",
    "medRxiv",
    "PeerJ Preprints",
    "Preprints.org",
    "SSRN",
    "PR_Newswire",
    "Quadrant",
    "Quillette",
    "Quora",
    "Raw_Story",
    "Reddit",
    "RedState",
    "ResearchGate",
    "Rolling_Stone_(politics_and_society,_2011\u2013present)",
    "Rolling_Stone_(Culture_Council)",
    "Scribd",
    "Scriptural_texts",
    "Simple_Flying",
    "Sixth_Tone_(politics)",
    "The_Skwawkbox",
    "SourceWatch",
    "Spirit_of_Metal",
    "Sportskeeda",
    "Stack_Exchange",
    "Stack_Overflow",
    "MathOverflow",
    "Ask_Ubuntu",
    "starsunfolded.com",
    "Statista",
    "TASS",
    "The_Truth_About_Guns",
    "TV.com",
    "TV_Tropes",
    "Twitter",
    "X.com",
    "Urban_Dictionary",
    "Venezuelanalysis",
    "VGChartz",
    "VoC",
    "Washington_Free_Beacon",
    "Weather2Travel",
    "The_Western_Journal",
    "We_Got_This_Covered",
    "WhatCulture",
    "Who's_Who_(UK)",
    "WhoSampled",
    "Wikidata",
    "WikiLeaks",
    "Wikinews",
    "Wikipedia",
    "WordPress.com",
    "Worldometer",
    "YouTube",
    "ZDNet"}
DEPRECATED = {
    "Al_Mayadeen",
    "ANNA_News",
    "Baidu_Baike",
    "China_Global_Television_Network",
    "The_Cradle",
    "Crunchbase",
    "The_Daily_Caller",
    "Daily_Mail",
    "Daily_Star",
    "The_Epoch_Times",
    "FrontPage_Magazine",
    "The_Gateway_Pundit",
    "Global_Times",
    "The_Grayzone",
    "HispanTV",
    "Jihad_Watch",
    "Last.fm",
    "LifeSiteNews",
    "The_Mail_on_Sunday",
    "MintPress_News",
    "National_Enquirer",
    "New_Eastern_Outlook",
    "News_Break",
    "NewsBlaze",
    "News_of_the_World",
    "Newsmax",
    "NNDB",
    "Occupy_Democrats",
    "Office_of_Cuba_Broadcasting",
    "One_America_News_Network",
    "Peerage_websites",
    "Press_TV",
    "Project_Veritas",
    "Rate_Your_Music",
    "Republic_TV",
    "Royal_Central",
    "RT",
    "Sputnik",
    "The_Sun",
    "Taki's_Magazine",
    "Tasnim_News_Agency",
    "Telesur",
    "The_Unz_Review",
    "VDARE",
    "Voltaire_Network",
    "WorldNetDaily",
    "Zero_Hedge"
}
BLACKLISTED = {
    "Advameg",
    "bestgore.com",
    "Breitbart_News",
    "Centre_for_Research_on_Globalization",
    "Examiner.com",
    "Famous_Birthdays",
    "Healthline",
    "InfoWars",
    "Lenta.ru",
    "LiveLeak",
    "Lulu.com",
    "MyLife",
    "Natural_News",
    "OpIndia",
    "The_Points_Guy",
    "The_Points_Guy_(sponsored_content)",
    "Swarajya",
    "Veterans_Today",
    "ZoomInfo"
}


def is_valid_wikipedia_source(url):
    parsed_url = urlparse(url)
    # Check if the URL is from a reliable domain
    combined_set = GENERALLY_UNRELIABLE | DEPRECATED | BLACKLISTED
    for domain in combined_set:
        if domain in parsed_url.netloc:
            return False

    return True


class StormRetriever(Retriever):
    def __init__(self, rm: Union[dspy.Retrieve, List[dspy.Retrieve]], k=3):
        super().__init__(search_top_k=k)
        self._rm = rm
        if not isinstance(self._rm, list):
            self._rm = [self._rm]
        
        # create a dictionary with the retrievers
        self._rm = {self._rm[i].nickname.lower().strip() : self._rm[i] for i in range(len(self._rm))}
        # check if there are two retrievers with the same nickname and raise an error
        if len(self._rm.keys()) != len(set(self._rm.keys())):
            raise ValueError("There are two retrievers with the same nickname.")
        
        for rm_name in self._rm:
            if hasattr(self._rm[rm_name], 'is_valid_source'):
                self._rm[rm_name].is_valid_source = is_valid_wikipedia_source
    
    def get_nicknames_and_descriptions(self):
        return [(rm_name, self._rm[rm_name].description.strip()) for rm_name in self._rm]
    
    def retrieve(self, queries_with_systems: List[tuple[List[str], str]], exclude_urls: List[str] = []) -> List[Information]:
        general_retrieved_data_list = []
        for queries, system in queries_with_systems:
            if system in self._rm:
                retrieved_data_list = self._rm[system](query_or_queries=queries, exclude_urls=exclude_urls)
                for data in retrieved_data_list:
                    for j in range(len(data['snippets'])):
                        # STORM generate the article with citations. We do not consider multi-hop citations.
                        # Remove citations in the source to avoid confusion.
                        data['snippets'][j] = ArticleTextProcessing.remove_citations(data['snippets'][j])
                general_retrieved_data_list.extend(retrieved_data_list)
        return [StormInformation.from_dict(data) for data in general_retrieved_data_list]