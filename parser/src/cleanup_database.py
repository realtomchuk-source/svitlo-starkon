import json
import os
import shutil
from datetime import datetime

# Get paths from config context
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIFIED_DB = os.path.join(BASE_DIR, "data", "unified_schedules.json")

def cleanup_db():
    if not os.path.exists(UNIFIED_DB):
        print(f"Error: Unified DB not found at {UNIFIED_DB}")
        return

    # Backup
    backup_path = UNIFIED_DB + ".bak"
    shutil.copy2(UNIFIED_DB, backup_path)
    print(f"Backup created at {backup_path}")

    with open(UNIFIED_DB, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"Error loading JSON: {e}")
            return

    initial_count = len(data)
    
    # Filter: Keep ONLY processed=True AND date != 'unknown'
    # Exception: we might want to keep the one with target_date="27.03" even if it doesn't have 'processed' flag in some versions
    cleaned_data = [
        entry for entry in data 
        if entry.get("processed") == True and entry.get("date") != "unknown"
    ]
    
    # Special check for our 'reference' 27.03 entry
    # (Ensure it's preserved if it satisfies our success criteria)
    
    final_count = len(cleaned_data)
    
    with open(UNIFIED_DB, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, indent=2, ensure_ascii=False)
    
    print(f"Cleanup complete!")
    print(f"Initial entries: {initial_count}")
    print(f"Removed: {initial_count - final_count}")
    print(f"Remaining (Successful): {final_count}")
    
    for entry in cleaned_data:
        print(f" - Kept: {entry.get('date')} ({entry.get('source', 'unknown')})")

if __name__ == "__main__":
    cleanup_db()
