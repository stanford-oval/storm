import os
from openai import OpenAI
RESOURCE_NAME = 'rws-llm'
DEPLOYMENT_NAME = 'gpt-4o'
API_VERSION = '2024-05-01-preview'
API_KEY = 'aa8088977e2143878b4045ca794d3709'

# client = OpenAI(
#     api_key='aa8088977e2143878b4045ca794d3709',
#     #base_url="https://rws-llm.openai.azure.com/"
#     base_url = f"https://{RESOURCE_NAME}.openai.azure.com/openai/deployments/{DEPLOYMENT_NAME}/chat/completions?api-version={API_VERSION}"
# )
client = OpenAI(
    # api_key='sk-TwR0ZuIbekYw2y1D2b124047D8164999A941AbBbEfBe931b',
    # base_url="https://llm-hub.ai-lifesci.cn/v1"
    api_key="sk-GeCKZFOuJoUidsnvKiF33Di9WMlkTI4vr97zu1ZS3grYIwxx",
    base_url="https://api.fe8.cn/v1"
)
def get_chat_completion(history):
    try:
        # Create chat completions using the OpenAI client
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Adjust the model 🐱 necessary
            messages=history  # Provide the chat history
        )
        return response
    except Exception as e:
        # logging.error(f"An error occurred: {e}")
        print(f"An error occurred: {e}")
        return None

his = [{"role": "user", "content": "自动化的核心课程，回复少于20个字"},]
print(get_chat_completion(his))




