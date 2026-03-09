import json
import os
import time
import requests
import logging
from datetime import datetime, timedelta
import pytz
from config import STATE_FILE, LOGS_DIR, TIMEZONE

# Setup logging
os.makedirs(LOGS_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOGS_DIR, "parser.log"), encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("SSSK-Utils")

TZ = pytz.timezone(TIMEZONE)

def load_json(path, default=None):
    if not os.path.exists(path):
        return default if default is not None else {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading JSON from {path}: {e}")
        return default if default is not None else {}

def save_json(path, data):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving JSON to {path}: {e}")

def get_now():
    return datetime.now(TZ)

def send_telegram_alert(message):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning(f"Telegram alert skipped (missing credentials): {message}")
        return
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        resp = requests.post(url, json={"chat_id": chat_id, "text": message}, timeout=10)
        resp.raise_for_status()
        logger.info("Telegram alert sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send telegram alert: {e}")

def should_run(state):
    from config import PEAK_HOUR_START, PEAK_HOUR_END, PEAK_INTERVAL, DEFAULT_INTERVAL_HOURS
    now = get_now()
    
    # 1. Перевірка Override
    override_until_str = state.get("override_until")
    if override_until_str:
        override_until = datetime.fromisoformat(override_until_str)
        if now < override_until:
            interval = state.get("override_interval_minutes", 0)
            if interval <= 0: 
                logger.info("Override active (forced run).")
                return True
            
            last_run_str = state.get("last_run")
            if not last_run_str: return True
            
            last_run = datetime.fromisoformat(last_run_str)
            if (now - last_run).total_seconds() / 60 >= interval:
                return True
            return False
        else:
            state["override_until"] = None
            state["override_interval_minutes"] = None
            save_json(STATE_FILE, state)
            logger.info("Override expired.")

    # 2. Стандартний розклад
    curr_hour = now.hour
    last_run_str = state.get("last_run")
    if not last_run_str: return True
    last_run = datetime.fromisoformat(last_run_str)
    
    # Піковий годинник (кожні PEAK_INTERVAL хвилин)
    if PEAK_HOUR_START <= curr_hour < PEAK_HOUR_END:
        return (now - last_run).total_seconds() / 60 >= PEAK_INTERVAL
    
    # Решта доби (DEFAULT_INTERVAL_HOURS годин)
    return (now - last_run).total_seconds() / 3600 >= DEFAULT_INTERVAL_HOURS

def cleanup_old_files(directory, days=7):
    if not os.path.exists(directory): return
    now = time.time()
    for f in os.listdir(directory):
        f_path = os.path.join(directory, f)
        if os.stat(f_path).st_mtime < now - (days * 86400):
            try:
                if os.path.isfile(f_path):
                    os.remove(f_path)
                    logger.info(f"Removed old file: {f}")
            except Exception as e:
                logger.error(f"Error removing file {f_path}: {e}")

