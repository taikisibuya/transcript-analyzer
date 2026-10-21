import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

print("=== รายชื่อโมเดล Embedding ในบัญชีของคุณ ===")
try:
    for model in client.models.list():
        if "embed" in model.name.lower():
            print(f"- {model.name}")
except Exception as e:
    print("Error:", e)