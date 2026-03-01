import os
import requests
from datetime import datetime
import hashlib

def run_telegram_parser(state):
    print("Parsing Telegram channel...")
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        print("Telegram bot credentials missing.")
        return None

    # Отримуємо останній пост з каналу через getUpdates (або краще через getChat, якщо бот адмін)
    # Оскільки бот у закритому каналі, він має отримувати повідомлення.
    # Найпростіший спосіб без вебхуків та постійного прослуховування - перевірити останні оновлення
    # Або використовувати метод, де ми знаємо ID каналу.
    
    # Для публічних або приватних каналів де бот адмін:
    # Telegram Bot API не має прямого методу "get_last_message_from_channel".
    # Але ми можемо використовувати getUpdates, якщо бот завантажений повідомленнями.
    # Проте надійніше для розробника - передати боту ID і чекати.
    
    # ПРИМІТКА: Для роботи на GitHub Actions (де сесія коротка), 
    # найкраще якщо бот отримує повідомлення і ми перевіряємо останні 10-20 оновлень.
    
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        resp = requests.get(url, timeout=30)
        data = resp.json()
    except Exception as e:
        print(f"Telegram API error: {e}")
        return None

    if not data.get("ok"):
        print(f"Telegram API returned error: {data}")
        return None

    # Шукаємо останнє повідомлення з фото з потрібного чату
    # (chat_id може бути -100123456789 для каналів)
    updates = [u for u in data["result"] if "message" in u or "channel_post" in u]
    photo_post = None
    
    for u in reversed(updates):
        msg = u.get("message") or u.get("channel_post")
        if not msg: continue
        
        # Перевіряємо chat_id (якщо воно задано)
        if str(msg["chat"]["id"]) != str(chat_id):
            continue
            
        if "photo" in msg:
            photo_post = msg
            break
    
    if not photo_post:
        print("No photo posts found in the telegram updates.")
        return None

    # Беремо фото з найбільшим розрішенням
    photo_file_id = photo_post["photo"][-1]["file_id"]
    caption = photo_post.get("caption", "")
    
    # Завантажуємо файл
    try:
        file_url = f"https://api.telegram.org/bot{token}/getFile?file_id={photo_file_id}"
        file_info = requests.get(file_url).json()
        file_path = file_info["result"]["file_path"]
        img_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        img_bytes = requests.get(img_url).content
    except Exception as e:
        print(f"Error downloading photo from Telegram: {e}")
        return None

    new_hash = hashlib.md5(img_bytes).hexdigest()
    last_hash = state.get("last_telegram_hash")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_path = f"data/raw_telegram/{timestamp}.jpg"
    
    with open(raw_path, "wb") as f:
        f.write(img_bytes)

    if new_hash == last_hash:
        print("Telegram image hash match. No changes.")
        return {"changed": False, "raw_path": raw_path, "hash": new_hash}

    print("New image detected in Telegram!")
    return {
        "changed": True,
        "raw_path": raw_path,
        "hash": new_hash,
        "img_bytes": img_bytes,
        "caption": caption
    }
