API_KEY = "sk-GeCKZFOuJoUidsnvKiF33Di9WMlkTI4vr97zu1ZS3grYIwxx"
BASE_URL = "https://api.fe8.cn/v1"

def test1():
    import openai
    openai.api_key = API_KEY
    openai.base_url = BASE_URL
    def get_chat_completion(history):
        try:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=history)
            return response
        except Exception as e:
            print(f"An error occurred: {e}")
            return None
    his = [{"role": "user", "content": "自动化的核心课程，回复少于20个字"}, ]
    print(get_chat_completion(his))

def test0():
    import openai
    client = openai.OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL)
    def get_chat_completion(history):
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=history)
            return response
        except Exception as e:
            print(f"An error occurred: {e}")
            return None
    his = [{"role": "user", "content": "自动化的核心课程，回复少于20个字"}, ]
    print(get_chat_completion(his))


if __name__ == '__main__':
    test0()
