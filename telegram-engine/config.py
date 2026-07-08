import os
from dotenv import load_dotenv

load_dotenv()

API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")
SESSION_NAME = os.getenv("SESSION_NAME", "nayra")

NEXTJS_API = os.getenv(
    "NEXTJS_API",
    "http://localhost:3000/api/telethon/reply"
)