import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LOGS_DIR = os.path.join(DATA_DIR, "logs")

STATE_FILE = os.path.join(DATA_DIR, "state.json")
UNIFIED_DB = os.path.join(DATA_DIR, "unified_schedules.json")
SCHEDULE_API_FILE = os.path.join(DATA_DIR, "schedule_api.json")

RAW_SITE_DIR = os.path.join(DATA_DIR, "raw_site")
ARCHIVE_DIR = os.path.join(DATA_DIR, "archive")
PWA_DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "pwa", "data")

HISTORY_API_FILE = os.path.join(PWA_DATA_DIR, "history_api.json")
HEALTH_FILE = os.path.join(PWA_DATA_DIR, "health.json")
TODAY_JSON_FILE = os.path.join(PWA_DATA_DIR, "today.json")
# RAW_TELEGRAM_DIR removed (Telegram purge)

TIMEZONE = "Europe/Kiev"

OBL_URL = "https://hoe.com.ua/page/pogodinni-vidkljuchennja"
HEADERS = {"User-Agent": "SSSK-Monitor/2.0 (Professional)"}

PEAK_HOUR_START = 19
PEAK_HOUR_END = 23
PEAK_INTERVAL = 15
DEFAULT_INTERVAL_HOURS = 5
