import os

# Paths (Relative to parser root or absolute)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
LOGS_DIR = os.path.join(DATA_DIR, "logs")

STATE_FILE = os.path.join(DATA_DIR, "state.json")
UNIFIED_DB = os.path.join(DATA_DIR, "unified_schedules.json")
SCHEDULE_API_FILE = os.path.join(DATA_DIR, "schedule_api.json")

RAW_SITE_DIR = os.path.join(DATA_DIR, "raw_site")
RAW_TELEGRAM_DIR = os.path.join(DATA_DIR, "raw_telegram")

# Timezone
TIMEZONE = "Europe/Kiev"

# URLs & Headers
OBL_URL = "https://hoe.com.ua/page/pogodinni-vidkljuchennja"
HEADERS = {"User-Agent": "SSSK-Monitor/2.0 (Professional)"}

# Schedule Intervals (Minutes)
PEAK_HOUR_START = 19
PEAK_HOUR_END = 23
PEAK_INTERVAL = 15
DEFAULT_INTERVAL_HOURS = 5
