import os
import sys
import re
import json
from datetime import datetime, timedelta
from modules.utils import load_json, save_json, get_now, should_run, send_telegram_alert, cleanup_old_files, STATE_FILE, UNIFIED_DB
from modules.site_parser import run_site_parser
from modules.telegram_parser import run_telegram_parser
from modules.ocr_helper import extract_text_from_image

def main():
    state = load_json(STATE_FILE, default={
        "last_run": None,
        "last_success_site": None,
        "last_success_telegram": None,
        "last_site_hash": None,
        "last_telegram_hash": None,
        "current_source": "both",
        "override_until": None,
        "override_interval_minutes": None
    })
    
    # 1. Обробка ручних налаштувань (Override) та конфігурації
    override_source = os.getenv("OVERRIDE_SOURCE")
    if override_source:
        state["current_source"] = override_source
    
    override_interval = os.getenv("OVERRIDE_INTERVAL") or "0"
    if int(override_interval) > 0:
        now = get_now()
        duration_h = int(os.getenv("OVERRIDE_DURATION") or "1")
        state["override_until"] = (now + timedelta(hours=duration_h)).isoformat()
        state["override_interval_minutes"] = int(override_interval)
        print(f"Override activated: {override_interval}m until {state['override_until']}")
    
    # 2. Перевірка розкладу
    if not should_run(state):
        print("Skipping run (schedule policy).")
        # Але ми все одно робимо коміт логів/стану, якщо це був workflow_dispatch
        return

    print(f"Starting parser run at {get_now().isoformat()} mode: {state['current_source']}")
    
    site_res = None
    tele_res = None
    
    # 3. Запуск підмодулів
    if state["current_source"] in ["both", "site"]:
        site_res = run_site_parser(state)
        if site_res and site_res.get("hash"):
            state["last_site_hash"] = site_res["hash"]
            state["last_success_site"] = get_now().isoformat()

    if state["current_source"] in ["both", "telegram"]:
        tele_res = run_telegram_parser(state)
        if tele_res and tele_res.get("hash"):
            state["last_telegram_hash"] = tele_res["hash"]
            state["last_success_telegram"] = get_now().isoformat()

    # 4. Аналіз та Пріоритезація
    final_data = None
    source_used = None
    is_updated = False
    
    # ТРІГЕР: Telegram має пріоритет у Dual Mode
    if tele_res and tele_res.get("changed"):
        final_data = tele_res
        source_used = "telegram"
        is_updated = True
    elif site_res and site_res.get("changed"):
        final_data = site_res
        source_used = "site"
        is_updated = True
        
    # 5. Якщо виявлено зміни - обробляємо OCR та зберігаємо в БД
    if final_data and is_updated:
        raw_text = extract_text_from_image(final_data["img_bytes"])
        caption = final_data.get("caption", "").lower()
        
        # Перевірка ключового слова "ОНОВЛЕНО" (також шукаємо "оновлено")
        is_emergency = "оновлено" in caption or "оновлен" in caption or "термінов" in caption
        
        # Спроба знайти дату в тексті (спрощений варіант)
        # У майбутньому тут буде складніший регулярний вираз
        date_found = None
        if "на" in raw_text:
             # Наприклад, "на 03.03"
             matches = re.findall(r"\d{2}\.\d{2}", raw_text)
             if matches: date_found = matches[0]

        entry = {
            "timestamp": get_now().isoformat(),
            "target_date": date_found,
            "source": source_used,
            "raw_path": final_data["raw_path"],
            "is_update": is_emergency or (state["last_run"] is None), # Перший запуск = True
            "processed": False,
            "raw_text_summary": raw_text[:500]
        }
        
        db = load_json(UNIFIED_DB, default=[])
        db.append(entry)
        save_json(UNIFIED_DB, db)
        
        # Оновлюємо мітки успіху
        if source_used == "site": state["last_success_site"] = get_now().isoformat()
        else: state["last_success_telegram"] = get_now().isoformat()
        
        print(f"!!! NEW SCHEDULE DETECTED via {source_used} !!!")
        if is_emergency:
            send_telegram_alert(f"🚨 ВИЯВЛЕНО ОНОВЛЕНИЙ ГРАФІК ({source_used})! Перевірте систему.")

    # 6. Очищення старих даних (Data Lake rotation)
    cleanup_old_files("data/raw_site", days=7)
    cleanup_old_files("data/raw_telegram", days=7)
    cleanup_old_files("data/logs", days=30)
    
    # 7. Завершення
    state["last_run"] = get_now().isoformat()
    save_json(STATE_FILE, state)
    print("Run completed.")

if __name__ == "__main__":
    main()
