import os
import sys

# Add parser/src to path
sys.path.insert(0, os.path.join(os.getcwd(), 'parser', 'src'))

from parse_schedule import generate_api_export, generate_today_json_from_db
from modules.utils import load_json
from config import UNIFIED_DB

print("Forcing regeneration of SSSK exports...")
db = load_json(UNIFIED_DB, default=[])

if not db:
    print("Error: Unified DB is empty!")
    sys.exit(1)

# 1. Regenerate History API (with new full queue data)
generate_api_export(db)
print("history_api.json regenerated.")

# 2. Regenerate Today JSON (with correct paths fixed previously)
generate_today_json_from_db()
print("today.json regenerated.")

print("DONE.")
