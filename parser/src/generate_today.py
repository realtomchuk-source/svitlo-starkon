import os
import sys
import json
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modules.utils import load_json, save_json, get_now
from config import UNIFIED_DB, DATA_DIR, SCHEDULE_API_FILE, TODAY_JSON_FILE

logger = logging.getLogger("SSSK-GenerateToday")

STATUS_FILE = os.path.join(DATA_DIR, "parser_status.json")


def generate_today_json():
    db = load_json(UNIFIED_DB, default=[])

    today_str = get_now().strftime("%d.%m")
    tomorrow_str = (get_now() + timedelta(days=1)).strftime("%d.%m")

    best_entry = None
    for entry in reversed(db):
        td = entry.get("target_date")
        # Only use successfully processed entries
        if entry.get("processed") and td and (td == today_str or td == tomorrow_str):
            best_entry = entry
            break

    if not best_entry:
        logger.warning(f"No schedule data found for {today_str} or {tomorrow_str}. Applying 'All-Clear' fallback.")
        # Fallback: All queues available, no outages
        queues = {str(i): ["1"] * 24 for i in [1, 2, 3, 4, 5, 6, "4.1", "4.2"]}
        today_data = {
            "date": today_str,
            "updated_at": get_now().isoformat(),
            "mode": "schedule",
            "message": "Графік обмежень не оприлюднено. Попередньо: відключень не прогнозується.",
            "has_tomorrow": False,
            "queues": queues,
            "is_fallback": True
        }
    else:
        queues = best_entry.get("queues")
        mode = best_entry.get("mode", "schedule")
        date_short = best_entry.get("date", today_str)
        date_full = best_entry.get("date_full", "")

        if not queues:
            logger.warning("No structured queue data in latest entry")
            write_status("error", "No queues")
            return False

        today_data = {
            "date": date_short,
            "updated_at": get_now().isoformat(),
            "mode": mode,
            "message": best_entry.get("message", f"Графік погодинних відключень на {date_full}"),
            "has_tomorrow": (date_short == tomorrow_str),
            "queues": queues,
        }

    try:
        os.makedirs(os.path.dirname(TODAY_JSON_FILE), exist_ok=True)
        save_json(TODAY_JSON_FILE, today_data)
        logger.info(f"today.json generated: {TODAY_JSON_FILE}")
        write_status("ok", today_data)
        return True
    except Exception as e:
        logger.error(f"Failed to write today.json: {e}")
        write_status("error", str(e))
        return False


def write_status(status, data=None):
    status_data = load_json(STATUS_FILE, default={})
    status_data["last_today_generated"] = get_now().isoformat()
    status_data["last_today_validation"] = status
    if data and isinstance(data, dict):
        status_data["today_mode"] = data.get("mode")
        status_data["today_date"] = data.get("date")
    elif status == "error":
        status_data["today_error"] = str(data)
    save_json(STATUS_FILE, status_data)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
    success = generate_today_json()
    sys.exit(0 if success else 1)
