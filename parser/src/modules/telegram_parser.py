import os
import requests
import hashlib
import logging
from config import RAW_TELEGRAM_DIR

logger = logging.getLogger("SSSK-TelegramParser")

def run_telegram_parser(state):
    logger.info("Parsing Telegram channel...")
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        logger.error("Telegram bot credentials missing.")
        return None

    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        resp = requests.get(url, timeout=30)
        data = resp.json()
    except Exception as e:
        logger.error(f"Telegram API fetch error: {e}")
        return None

    if not data.get("ok"):
        logger.error(f"Telegram API returned error: {data}")
        return None

    updates = [u for u in data["result"] if "message" in u or "channel_post" in u]
    photo_post = None
    
    for u in reversed(updates):
        msg = u.get("message") or u.get("channel_post")
        if not msg: continue
        
        if str(msg["chat"]["id"]) != str(chat_id):
            continue
            
        if "photo" in msg:
            photo_post = msg
            break
    
    if not photo_post:
        logger.warning("No photo posts found in the telegram updates for target chat.")
        return None

    photo_file_id = photo_post["photo"][-1]["file_id"]
    caption = photo_post.get("caption", "")
    
    try:
        file_url_req = f"https://api.telegram.org/bot{token}/getFile?file_id={photo_file_id}"
        file_info = requests.get(file_url_req, timeout=10).json()
        file_path = file_info["result"]["file_path"]
        img_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        img_bytes = requests.get(img_url, timeout=20).content
    except Exception as e:
        logger.error(f"Error downloading photo from Telegram: {e}")
        return None

    new_hash = hashlib.md5(img_bytes).hexdigest()
    last_hash = state.get("last_telegram_hash")
    
    from modules.utils import get_now
    timestamp = get_now().strftime("%Y%m%d_%H%M%S")
    raw_path = os.path.join(RAW_TELEGRAM_DIR, f"{timestamp}.jpg")
    
    os.makedirs(RAW_TELEGRAM_DIR, exist_ok=True)
    
    with open(raw_path, "wb") as f:
        f.write(img_bytes)

    if new_hash == last_hash:
        logger.info("Telegram image hash match. No changes.")
        return {"changed": False, "raw_path": raw_path, "hash": new_hash}

    logger.info("New image detected in Telegram!")
    return {
        "changed": True,
        "raw_path": raw_path,
        "hash": new_hash,
        "img_bytes": img_bytes,
        "caption": caption
    }
