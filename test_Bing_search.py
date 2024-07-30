import requests


subscription_key = "87d6bae29e8e418196e009fc982caef8"
assert subscription_key

# search_url = "https://api.bing.microsoft.com/v7.0/search"
search_url = "https://api.bing.microsoft.com/"
search_term = "Microsoft Bing Search Services"

import requests

# headers = {"Ocp-Apim-Subscription-Key": subscription_key}
# params = {"q": search_term, "textDecorations": True, "textFormat": "HTML"}
# response = requests.get(search_url, headers=headers, params=params)
# response.raise_for_status()
# search_results = response.json()


headers = {"Ocp-Apim-Subscription-Key": subscription_key}
params = {"q": search_term}
response = requests.get(search_url, headers=headers, params=params)

# 检查是否有错误
response.raise_for_status()

# 打印返回的结果
print(response.json())