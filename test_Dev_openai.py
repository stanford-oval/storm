from openai import OpenAI

client = OpenAI(
    api_key = "sk-GeCKZFOuJoUidsnvKiF33Di9WMlkTI4vr97zu1ZS3grYIwxx",
    base_url = "https://api.fe8.cn/v1"
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "讲个笑话",
        }
    ],
    model="gpt-3.5-turbo",
)
print(chat_completion.choices[0].message.content)
