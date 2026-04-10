import os
import sys
import re
import json
import logging
from datetime import datetime, timedelta
from modules.utils import load_json, save_json, get_now, should_run, cleanup_old_files, is_tomorrow_processed
from modules.site_parser import run_site_parser
from modules.ocr_helper import extract_text_from_image
from modules.table_parser import parse_schedule_from_text, validate_queues
from modules.text_parser import apply_text_overrides
from config import STATE_FILE, UNIFIED_DB, SCHEDULE_API_FILE, RAW_SITE_DIR, LOGS_DIR, HISTORY_API_FILE, HEALTH_FILE, ARCHIVE_DIR, EVENING_START_HOUR

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

def update_health(status="ok", message="", mode="IDLE"):
    """Saves system health metrics."""
    health = {
        "timestamp": get_now().isoformat(),
        "status": status,
        "mode": mode,
        "message": message,
        "version": "2.1-Adaptive"
    }
    save_json(HEALTH_FILE, health)

def generate_api_export(db):
    api_entries = []
    now = get_now()
    # We want to keep approx 8 days of history for the "Digest" to work properly
    cutoff = now - timedelta(days=8)
    
    filtered_entries = []
    for entry in db:
        try:
            ts_str = entry.get("timestamp")
            if not ts_str: continue
            ts = datetime.fromisoformat(ts_str)
            # Ensure timezone awareness for comparison
            if ts.tzinfo is None:
                from modules.utils import TZ
                ts = TZ.localize(ts)
            
            if ts > cutoff:
                filtered_entries.append(entry)
        except:
            continue
            
    # Fallback: if time-based filtering results in too few entries, take last 50
    if len(filtered_entries) < 30:
        filtered_entries = db[-50:]

    for entry in filtered_entries:
        api_entry = {
            "timestamp": entry.get("timestamp"),
            "target_date": entry.get("target_date"),
            "source": entry.get("source"),
            "change_desc": entry.get("change_desc", ""),
            "is_update": entry.get("is_update", False),
            "processed": entry.get("processed", False),
            "queues": entry.get("queues", {}),
            "mode": entry.get("mode", "schedule"),
            "date": entry.get("date", ""),
            "date_full": entry.get("date_full", ""),
            "message": entry.get("message", ""),
            "announcements": entry.get("announcements", []),
            "queues_raw": entry.get("queues_raw", {})
        }
        api_entries.append(api_entry)

    save_json(HISTORY_API_FILE, api_entries)
    logger.info(f"history_api.json exported: {len(api_entries)} entries (Full 8-day history).")

def generate_today_json_from_db():
    from generate_today import generate_today_json
    return generate_today_json()

def process_image(img_bytes, source_used, raw_path, state, html_content=None):
    """Core logic to process an image bytes into the database."""
    logger.info(f"Processing image from {source_used}...")
    raw_text = extract_text_from_image(img_bytes)
    structured = parse_schedule_from_text(raw_text, img_bytes)
    
    date_found = structured.get("date") if structured else None
    if not date_found and raw_text:
        matches = re.findall(r"\d{2}\.\d{2}", raw_text)
        if matches: date_found = matches[0]

    entry = {
        "timestamp": get_now().isoformat(),
        "target_date": date_found,
        "source": source_used,
        "raw_path": raw_path,
        "is_update": state["last_run"] is None or "оновлено" in (raw_text or "").lower(),
        "processed": False,
        "raw_text_summary": raw_text[:500] if raw_text else "",
        "announcements": []
    }

    if structured:
        # Keep a clean copy of original queues from the image
        entry["queues_raw"] = structured["queues"].copy() if "queues" in structured else {}
        
        if html_content:
             logger.info("Applying text overrides from HTML...")
             structured["queues"], announcements = apply_text_overrides(structured["queues"], html_content, date_found)
             entry["announcements"] = announcements

    if structured and validate_queues(structured.get("queues", {})):
        entry.update({
            "queues": structured["queues"],
            "queues_raw": entry.get("queues_raw", {}), # Explicitly include raw here
            "mode": structured["mode"],
            "date": structured["date"],
            "date_full": structured["date_full"],
            "message": structured["message"],
            "processed": True
        })
        db = load_json(UNIFIED_DB, default=[])
        last_entry = db[-1] if db else None
        entry["change_desc"] = calculate_delta(last_entry, entry)
        db.append(entry)
        save_json(UNIFIED_DB, db)
        generate_api_export(db)
        logger.info(f"SUCCESS: Processed {source_used} schedule for {date_found}")
        return True
    else:
        logger.error(f"FAILED to parse structure from {source_used}")
        return False

def main():
    logger.info("Starting SSSK Parser cycle (Adaptive Intelligence Mode)")

    state = load_json(STATE_FILE, default={
        "last_run": None,
        "last_site_hash": None,
        "last_html_hash": None,
        "current_source": "site"
    })

    now = get_now()
    curr_hour = now.hour
    curr_minute = now.minute

    # 0. Статус розкладу на завтра та режим моніторингу
    tomorrow_ready = is_tomorrow_processed()
    is_aggressive = EVENING_START_HOUR <= curr_hour <= 23 and not tomorrow_ready

    # 1. Спеціальна обробка: Дедлайн 23:50 (Авто-світло)
    from generate_today import generate_today_json
    if curr_hour == 23 and curr_minute >= 50:
        if not tomorrow_ready:
            logger.info("DEADLINE reached: Tomorrow schedule not found. Ensuring power-on state.")
            update_health("ok", "Дедлайн: Графік не знайдено, світло є", "DEADLINE")
            generate_today_json()
            return

    # 1.5 Автоматична "заготовка" на завтра (після 19:00)
    tomorrow_str = (now + timedelta(days=1)).strftime("%d.%m")
    if is_aggressive:
        db = load_json(UNIFIED_DB, default=[])
        # Перевіряємо, чи є вже будь-який запис на завтра (навіть не оброблений)
        has_tomorrow = any(e.get("target_date") == tomorrow_str for e in db)
        if not has_tomorrow:
            logger.info(f"Creating placeholder for tomorrow: {tomorrow_str}")
            placeholder = {
                "timestamp": now.isoformat(),
                "target_date": tomorrow_str,
                "source": "system",
                "type": "schedule",
                "processed": False,
                "is_placeholder": True,
                "message": f"Очікування публікації графіка на {tomorrow_str}",
                "queues": {},
                "change_desc": f"Створено заготовку (очікуємо {tomorrow_str})"
            }
            db.append(placeholder)
            save_json(UNIFIED_DB, db)
            generate_api_export(db)
            generate_today_json() # Trigger today generation to update status
    
    # Визначаємо режим для health
    current_mode = "DAY"
    if is_aggressive: current_mode = "AGGRESSIVE"
    elif curr_hour < 6 or (curr_hour >= 20 and tomorrow_ready): current_mode = "IDLE"

    # 2. Перевірка розкладу
    if not should_run(state):
        logger.info("SmartRun: Skipping (interval not reached).")
        update_health("ok", "Очікування наступного запуску", current_mode)
        return

    # 3. Пріоритетне завдання вже визначене через is_aggressive

    # 4. Легкий моніторинг (Детектор змін)
    from modules.site_parser import check_site_light
    current_light_hash = check_site_light()
    last_light_hash = state.get("last_html_hash")
    
    site_changed = current_light_hash and current_light_hash != last_light_hash
    if site_changed:
        logger.info("DETECTOR: Site HTML changed! Forcing heavy scan.")

    # 5. Виконання завдань
    # А) Пошук графіка на завтра в новинах (якщо вечір і ще не знайдено)
    if is_aggressive:
        logger.info("Mode: AGGRESSIVE. Searching for tomorrow's schedule in News...")

    # Б) Стандартний моніторинг головної (якщо є зміни або плановий запуск)
    # Плановий запуск кожні 2 години в будь-якому випадку для надійності
    last_run_str = state.get("last_run")
    last_run = datetime.fromisoformat(last_run_str) if last_run_str else now - timedelta(hours=5)
    # Ensure last_run is timezone aware for comparison if now is TZ aware
    if last_run.tzinfo is None:
        last_run = TZ.localize(last_run)
    force_heavy = (now - last_run).total_seconds() / 3600 >= 2

    if site_changed or force_heavy or is_aggressive:
        logger.info(f"Executing heavy scan. Reason: site_changed={site_changed}, force={force_heavy}, aggressive={is_aggressive}")
        
        site_res = run_site_parser(state)
        if site_res:
            state["last_site_hash"] = site_res.get("hash")
            state["last_html_hash"] = site_res.get("html_hash")
            
            # Одержуємо поточну базу для аналізу змін
            db = load_json(UNIFIED_DB, default=[])
            last_valid_entry = db[-1] if db else None
            
            # А) Зміна картинки або форсований запуск
            image_changed = site_res.get("changed")
            if image_changed:
                process_image(site_res["img_bytes"], "site", site_res["raw_path"], state, site_res.get("html"))
            
            # NEW: Run history crawler ALWAYS after potential heavy scan to sync text
            try:
                from history_crawler import process_history
                logger.info("Running history crawler to sync announcements...")
                process_history(limit_days=3)
                # Refresh DB reference after crawler updates
                db = load_json(UNIFIED_DB, default=[])
            except Exception as e:
                logger.error(f"Post-scan crawler error: {e}")

            # NOTE: history_crawler handles deep extraction, 
            # we must ensure API is exported if crawler or site-parser made changes.
            generate_api_export(db)
            logger.info("History API exported.")
            
    else:
        logger.info("No tactical need for heavy scan (HTML hashes match and idle/day mode).")
        # Ensure API is still updated in case Crawler found text updates
        try:
            from history_crawler import process_history
            process_history(limit_days=3)
        except: pass
        
        db = load_json(UNIFIED_DB, default=[])
        generate_api_export(db)

    # 6. Оновлення вихідних даних
    generate_today_json()
    
    cleanup_old_files(RAW_SITE_DIR, days=7)
    cleanup_old_files(LOGS_DIR, days=30)

    state["last_run"] = now.isoformat()
    save_json(STATE_FILE, state)
    update_health("ok", "Цикл завершено успішно", current_mode)
    logger.info("Cycle completed successfully.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"FATAL: Unhandled exception: {e}", exc_info=True)
        update_health("err", f"Фатальна помилка скрипта: {str(e)}")
        sys.exit(1)
