import os
import sys
import re
import json
import logging
from datetime import datetime, timedelta
from modules.utils import load_json, save_json, get_now, should_run, cleanup_old_files
from modules.site_parser import run_site_parser
from modules.ocr_helper import extract_text_from_image
from modules.table_parser import parse_schedule_from_text, validate_queues
from modules.text_parser import apply_text_overrides
from config import STATE_FILE, UNIFIED_DB, SCHEDULE_API_FILE, RAW_SITE_DIR, LOGS_DIR, HISTORY_API_FILE, HEALTH_FILE

logger = logging.getLogger("SSSK-Main")

def calculate_delta(old_entry, new_entry):
    """Calculates semantic differences between two schedule entries."""
    if not old_entry or not new_entry: return "Перший запуск або відсутність даних"
    if old_entry.get("mode") != new_entry.get("mode"):
        return f"Зміна режиму: {old_entry.get('mode')} -> {new_entry.get('mode')}"
    
    old_q = old_entry.get("queues", {})
    new_q = new_entry.get("queues", {})
    
    changes = []
    for g in sorted(new_q.keys()):
        if g not in old_q: 
            changes.append(f"Додано чергу {g}")
            continue
        if old_q[g] != new_q[g]:
            # Simple heuristic: find first changed hour
            for h in range(24):
                if old_q[g][h] != new_q[g][h]:
                    action = "світло з'явиться" if new_q[g][h] == "1" else "світло зникне"
                    changes.append(f"Черга {g}: {action} о {h:02}:00")
                    break
    
    return "; ".join(changes) if changes else "Змін у самому графіку не виявлено (лише оновлення картинки або статтей)"

def update_health(status="ok", message=""):
    """Saves system health metrics."""
    health = {
        "timestamp": get_now().isoformat(),
        "status": status,
        "message": message,
        "version": "2.0-PRO"
    }
    save_json(HEALTH_FILE, health)

def generate_api_export(db):
    api_entries = []
    # Keep last 20 for history
    for entry in db[-20:]:
        api_entry = {
            "timestamp": entry.get("timestamp"),
            "target_date": entry.get("target_date"),
            "source": entry.get("source"),
            "change_desc": entry.get("change_desc", ""),
            "is_update": entry.get("is_update", False),
            "processed": entry.get("processed", False)
        }
        api_entries.append(api_entry)

    save_json(HISTORY_API_FILE, api_entries)
    logger.info(f"history_api.json exported: {len(api_entries)} entries.")

def generate_today_json_from_db():
    from generate_today import generate_today_json
    return generate_today_json()

def main():
    logger.info("Starting SSSK Parser cycle (Professional Mode)")

    state = load_json(STATE_FILE, default={
        "last_run": None,
        "last_success_site": None,
        "last_site_hash": None,
        "current_source": "site",
        "override_until": None,
        "override_interval_minutes": None
    })

    override_source = os.getenv("OVERRIDE_SOURCE")
    if override_source:
        state["current_source"] = override_source
        logger.info(f"Source override detected: {override_source}")

    override_interval = os.getenv("OVERRIDE_INTERVAL") or "0"
    if int(override_interval) > 0:
        now = get_now()
        duration_h = int(os.getenv("OVERRIDE_DURATION") or "1")
        state["override_until"] = (now + timedelta(hours=duration_h)).isoformat()
        state["override_interval_minutes"] = int(override_interval)
        logger.info(f"Interval override activated: {override_interval}m until {state['override_until']}")

    if not should_run(state):
        logger.info("Skipping run (schedule policy says no).")
        return

    logger.info(f"Executing parser run. Mode: {state['current_source']}")

    site_res = None
    if state["current_source"] in ["both", "site"]:
        site_res = run_site_parser(state)
        if site_res:
            state["last_site_hash"] = site_res.get("hash")
            state["last_html_hash"] = site_res.get("html_hash")
            state["last_success_site"] = get_now().isoformat()

    final_data = None
    source_used = None
    is_updated = False

    if site_res and site_res.get("changed"):
        final_data = site_res
        source_used = "site"
        is_updated = True

    if final_data and is_updated:
        logger.info(f"New schedule detected from {source_used}. Running OCR processing...")
        raw_text = extract_text_from_image(final_data["img_bytes"])
        caption = final_data.get("caption", "").lower()

        is_emergency = any(kw in caption for kw in ["оновлено", "оновлен", "термінов"])

        structured = parse_schedule_from_text(raw_text, final_data["img_bytes"])

        date_found = None
        if structured:
            date_found = structured.get("date")

        if not date_found:
            if "на" in raw_text:
                matches = re.findall(r"\d{2}\.\d{2}", raw_text)
                if matches:
                    date_found = matches[0]

        # --- TEXT OVERRIDES INTEGRATION ---
        if structured and site_res.get("html"):
             logger.info("Checking for textual overrides in HTML content...")
             updated_queues = apply_text_overrides(structured["queues"], site_res["html"])
             structured["queues"] = updated_queues
        # ----------------------------------

        db = load_json(UNIFIED_DB, default=[])
        last_entry = None
        # Find last entry for the SAME target date to calculate delta
        if date_found:
            last_entry = next((e for e in reversed(db) if e.get("target_date") == date_found), None)

        entry = {
            "timestamp": get_now().isoformat(),
            "target_date": date_found,
            "source": source_used,
            "raw_path": final_data["raw_path"],
            "is_update": is_emergency or (state["last_run"] is None),
            "processed": False,
            "raw_text_summary": raw_text[:500] if raw_text else ""
        }

        if structured and validate_queues(structured.get("queues", {})):
            entry.update({
                "queues": structured["queues"],
                "mode": structured["mode"],
                "date": structured["date"],
                "date_full": structured["date_full"],
                "message": structured["message"],
                "processed": True
            })
            entry["change_desc"] = calculate_delta(last_entry, entry)
            logger.info(f"Delta detected: {entry['change_desc']}")
        else:
            entry["change_desc"] = "Помилка при спробі розпізнати структуру"
            update_health("warn", "Низька якість розпізнавання таблиці")

        db.append(entry)
        save_json(UNIFIED_DB, db)
        generate_api_export(db)
        logger.info(f"!!! SUCCESS: Extracted data from {source_used} schedule !!!")
    else:
        logger.info("No content changes detected on source.")
        update_health("ok", "Система в очікуванні змін")

    # ALWAYS update today.json regardless of site changes
    # to handle date-rollover or force-refresh cases.
    generate_today_json_from_db()
    
    cleanup_old_files(RAW_SITE_DIR, days=7)
    cleanup_old_files(LOGS_DIR, days=30)

    state["last_run"] = get_now().isoformat()
    save_json(STATE_FILE, state)
    logger.info("Cycle completed successfully.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"FATAL: Unhandled exception: {e}", exc_info=True)
        update_health("err", f"Фатальна помилка скрипта: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"FATAL: Unhandled exception: {e}", exc_info=True)
        sys.exit(1)
