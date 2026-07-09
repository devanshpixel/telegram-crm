import requests
from config import NEXTJS_API

def get_ai_reply(telegram_id: str, access_hash: str | None, name: str, username: str | None, message: str, telegram_message_id: int | None):
    payload = {
        "telegramId": telegram_id,
        "accessHash": access_hash,
        "name": name,
        "username": username,
        "message": message,
        "telegramMessageId": telegram_message_id,
    }
    try:
        response = requests.post(NEXTJS_API, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data["reply"]
    except requests.exceptions.ReadTimeout:
        print("[API] timeout")
        raise
