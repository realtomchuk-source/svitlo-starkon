import json
import os
import time
import requests
from datetime import datetime, timedelta
import pytz

STATE_FILE = "data/state.json"
UNIFIED_DB = "data/unified_schedules.json"
TZ = pytz.timezone("Europe/Kiev")

def load_json(path, default=None):
    if not os.path.exists(path):
        return default if default is not None else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_now():
    return datetime.now(TZ)

def send_telegram_alert(message):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print(f"Telegram alert (skipped - no credentials): {message}")
        return
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": message})
    except Exception as e:
        print(f"Failed to send telegram alert: {e}")

def should_run(state):
    now = get_now()
    
    # 1. Перевірка Override
    override_until_str = state.get("override_until")
    if override_until_str:
        override_until = datetime.fromisoformat(override_until_str)
        if now < override_until:
            interval = state.get("override_interval_minutes", 0)
            if interval <= 0: return True # Форсований запуск без інтервалу
            
            last_run_str = state.get("last_run")
            if not last_run_str: return True
            
            last_run = datetime.fromisoformat(last_run_str)
            if (now - last_run).total_seconds() / 60 >= interval:
                return True
            return False
        else:
            # Термін дії override вийшов
            state["override_until"] = None
            state["override_interval_minutes"] = None
            save_json(STATE_FILE, state)

    # 2. Стандартний розклад
    curr_hour = now.hour
    last_run_str = state.get("last_run")
    if not last_run_str: return True
    last_run = datetime.fromisoformat(last_run_str)
    
    # Логіка згідно ТЗ:
    # 19:00 - 24:00 (Пік)
    if curr_hour >= 19:
        # Якщо вже є успішний запуск сьогодні ввечері, переходимо на 1 год
        last_success = state.get("last_success_site") or state.get("last_success_telegram")
        if last_success:
            ls_dt = datetime.fromisoformat(last_success)
            if ls_dt.date() == now.date() and ls_dt.hour >= 19:
                # Вуже отримали графік, чекаємо годину для перевірки змін
                return (now - last_run).total_seconds() / 60 >= 60
        return True # Кожні 5 хв (якщо GitHub Actions так налаштований)

    # 00:00 - 09:00 (Ніч)
    if 0 <= curr_hour < 9:
        return (now - last_run).total_seconds() / 3600 >= 5

    # 09:00 - 19:00 (День)
    if 9 <= curr_hour < 19:
        return (now - last_run).total_seconds() / 3600 >= 3

    # Fallback — завжди дозволити запуск
    return True

def cleanup_old_files(directory, days=7):
    if not os.path.exists(directory): return
    now = time.time()
    for f in os.listdir(directory):
        f_path = os.path.join(directory, f)
        if os.stat(f_path).st_mtime < now - (days * 86400):
            if os.path.isfile(f_path):
                os.remove(f_path)
                print(f"Removed old file: {f}")
