from telethon import events
from ai_client import get_ai_reply

def register_handlers(client):

    @client.on(events.NewMessage(incoming=True))
    async def on_message(event):
        if event.is_group:
            return

        sender = await event.get_sender()
        me = await client.get_me()

        if sender.id == me.id:
            return

        telegram_id = str(sender.id)
        access_hash = str(sender.access_hash) if sender.access_hash else None
        first = sender.first_name or ""
        last = sender.last_name or ""
        name = (first + " " + last).strip() or f"User {sender.id}"
        username = sender.username
        message = event.raw_text or ""

        if not message:
            return

        msg_id = event.message.id if event.message else None

        print(f"[RX] {name} ({telegram_id}): {message[:80]}")

        print(f"[API] POST {telegram_id}")
        try:
            reply = get_ai_reply(telegram_id, access_hash, name, username, message, msg_id)
        except Exception as e:
            print(f"[API] error: {e}")
            return

        print(f"[AI] {reply[:80]}")

        await client.send_message(sender, reply)
        print(f"[TX] {telegram_id}")
