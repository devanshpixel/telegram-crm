import time
from telethon import TelegramClient
from config import API_ID, API_HASH, SESSION_NAME
from handlers import register_handlers

client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

register_handlers(client)

async def main():
    print("✅ Telegram Engine Started")
    await client.run_until_disconnected()

while True:
    try:
        with client:
            client.loop.run_until_complete(main())
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f"[RECONNECT] {e} — retrying in 5s")
        time.sleep(5)
