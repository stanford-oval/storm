import json
import requests
import logging

RESOURCE_NAME = 'rws-llm'
DEPLOYMENT_NAME = 'gpt-4o'
API_VERSION = '2024-05-01-preview'
API_KEY = 'aa8088977e2143878b4045ca794d3709' # this is a test account. For production account, get API Key from other places



def get_chat_completion(full_message, credential = API_KEY):

    url = f"https://{RESOURCE_NAME}.openai.azure.com/openai/deployments/{DEPLOYMENT_NAME}/chat/completions?api-version={API_VERSION}"
    headers = {
        "Content-Type": "application/json",
        "api-key": credential
    }
    # role: can be system, user, assistant, tool, or function
    # to do: need to add message history
    logging.info(f"***Messages: {full_message}")
    data = json.dumps({"messages": full_message})
    logging.info(f"Sending request to {url}")
    response = requests.post(url, headers=headers, data=data)
    return response.json()  # Returns the parsed JSON response

def process_response(response):
    if "choices" in response and response["choices"]:
        for choice in response["choices"]:
            message = choice.get("message", {})
            try:
                if message.get("role") == "assistant":
                    return message.get("content", "No content provided")
            except Exception as e:
                logging.error(f"Error processing response: {e}")

    else:
        logging.info("No valid responses found in the data")


if __name__ == "__main__":
    # while True:
    #     user_input = input("You: ")
    #     response = get_chat_completion(user_input, [])
    #     processed_response = process_response(response)
    #     if processed_response:
    #         print(f"Assistant: {processed_response}")
    #     else:
    #         print("No valid response received")

    while True:
        user_input = input("You: ")
        hist = [{"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_input}]
        response = get_chat_completion(hist, API_KEY)
        print(response)