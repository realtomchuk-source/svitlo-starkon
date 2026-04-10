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

# send_telegram_alert removed (Telegram purge)

def is_tomorrow_processed():
    """Перевіряє, чи є в базі успішно оброблений графік на завтра."""
    from config import UNIFIED_DB
    db = load_json(UNIFIED_DB, default=[])
    tomorrow_str = (get_now() + timedelta(days=1)).strftime("%d.%m")
    
    # Шукаємо успішно оброблений запис на завтра
    for entry in reversed(db):
        if entry.get("target_date") == tomorrow_str and entry.get("processed"):
            return True
    return False

def should_run(state):
    from config import (
        MORNING_START_HOUR, EVENING_START_HOUR, 
        AGGRESSIVE_INTERVAL, DAY_MONITOR_INTERVAL, IDLE_INTERVAL
    )
    now = get_now()
    curr_hour = now.hour
    
    # 1. Перевірка Override (Ручний запуск)
    override_until_str = state.get("override_until")
    if override_until_str:
        override_until = datetime.fromisoformat(override_until_str)
        if now < override_until:
            logger.info("Override active (forced run).")
            return True
        else:
            state["override_until"] = None
            save_json(STATE_FILE, state)

    last_run_str = state.get("last_run")
    if not last_run_str: return True
    last_run = datetime.fromisoformat(last_run_str)
    diff_minutes = (now - last_run).total_seconds() / 60

    # 2. Визначення режиму
    tomorrow_ready = is_tomorrow_processed()
    
    # Режим AGGRESSIVE: Вечір і завтрашній графік ще не знайдено
    if EVENING_START_HOUR <= curr_hour <= 23 and not tomorrow_ready:
        mode = "AGGRESSIVE"
        interval = AGGRESSIVE_INTERVAL
    # Режим DAY: День (робочий час)
    elif MORNING_START_HOUR <= curr_hour < EVENING_START_HOUR:
        mode = "DAY"
        interval = DAY_MONITOR_INTERVAL
    # Режим IDLE: Ніч або графік на завтра вже є
    else:
        mode = "IDLE"
        interval = IDLE_INTERVAL

    should = diff_minutes >= interval
    if should:
        logger.info(f"SmartRun: Mode={mode}, Interval={interval}m, Diff={diff_minutes:.1f}m -> RUN")
    return should

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

