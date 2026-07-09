import os
from dotenv import load_dotenv

load_dotenv()

api_id_raw = os.getenv("API_ID")
api_hash_raw = os.getenv("API_HASH")
if not api_id_raw or not api_hash_raw:
    print("ERROR: API_ID and API_HASH must be set in .env")
    exit(1)
API_ID = int(api_id_raw)
API_HASH = api_hash_raw
SESSION_NAME = os.getenv("SESSION_NAME", "nayra")

NEXTJS_API = os.getenv(
    "NEXTJS_API",
    "http://127.0.0.1:3000/api/telethon/reply"
)