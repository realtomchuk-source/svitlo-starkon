import os
import sys
import json
import time
import logging
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modules.utils import load_json, save_json, get_now, cleanup_old_files
from modules.site_parser import run_site_parser
from modules.ocr_helper import extract_text_from_image
from modules.table_parser import parse_schedule_from_text, validate_queues
from config import (
    STATE_FILE, UNIFIED_DB, DATA_DIR, RAW_SITE_DIR,
    ARCHIVE_DIR, ARCHIVE_RAW_DIR, ARCHIVE_RETENTION_DAYS
)

logger = logging.getLogger("SSSK-Archive")


def get_today_archive_path():
    today = get_now().strftime("%Y-%m-%d")
    return os.path.join(ARCHIVE_DIR, f"{today}.json")


def load_today_archive():
    path = get_today_archive_path()
    if os.path.exists(path):
        return load_json(path, default={"date": get_now().strftime("%Y-%m-%d"), "captures": []})
    return {"date": get_now().strftime("%Y-%m-%d"), "captures": []}


def save_today_archive(archive_data):
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    path = get_today_archive_path()
    save_json(path, archive_data)
    logger.info(f"Archive saved: {path}")


def save_raw_image(img_bytes):
    os.makedirs(ARCHIVE_RAW_DIR, exist_ok=True)
    timestamp = get_now().strftime("%Y-%m-%d_%H-%M")
    path = os.path.join(ARCHIVE_RAW_DIR, f"{timestamp}.png")
    with open(path, "wb") as f:
        f.write(img_bytes)
    return path


def update_parser_status(status, data=None):
    from modules.utils import get_now
    status_file = os.path.join(DATA_DIR, "parser_status.json")
    status_data = load_json(status_file, default={})
    status_data["last_archive_captured"] = get_now().isoformat()
    status_data["last_archive_status"] = status
    if data:
        status_data["last_archive_target_date"] = data.get("target_date", "")
    save_json(status_file, status_data)


def run_archive_parser():
    logger.info("Starting Archive Parser cycle")

    state = load_json(STATE_FILE, default={})
    archive_data = load_today_archive()

    site_res = run_site_parser(state)

    if not site_res or not site_res.get("hash"):
        logger.warning("No schedule image found on site")
        update_parser_status("no_image")
        return False

    img_bytes = site_res.get("img_bytes")
    if img_bytes:
        raw_path = save_raw_image(img_bytes)
        logger.info(f"Raw image saved to archive: {raw_path}")

    structured = None
    if site_res.get("changed") and img_bytes:
        logger.info("New image detected, running OCR...")
        raw_text = extract_text_from_image(img_bytes)
        structured = parse_schedule_from_text(raw_text)

    if not structured:
        db = load_json(UNIFIED_DB, default=[])
        for entry in reversed(db):
            if entry.get("processed") and validate_queues(entry.get("queues", {})):
                structured = {
                    "date": entry.get("date", ""),
                    "date_full": entry.get("date_full", ""),
                    "mode": entry.get("mode", "schedule"),
                    "message": entry.get("message", ""),
                    "queues": entry.get("queues", {}),
                }
                logger.info("Reused structured data from unified_schedules.json")
                break

    if not structured or not validate_queues(structured.get("queues", {})):
        logger.warning("Could not parse structured data for archive")
        update_parser_status("parse_failed")
        return False

    capture = {
        "captured_at": get_now().isoformat(),
        "target_date": structured.get("date", ""),
        "mode": structured.get("mode", "schedule"),
        "queues": structured["queues"],
    }

    existing = archive_data.get("captures", [])
    updated = False
    for i, cap in enumerate(existing):
        if cap.get("target_date") == capture["target_date"]:
            existing[i] = capture
            updated = True
            logger.info(f"Updated existing capture for {capture['target_date']}")
            break

    if not updated:
        existing.append(capture)
        logger.info(f"New capture for {capture['target_date']}")

    archive_data["captures"] = existing
    save_today_archive(archive_data)

    cleanup_old_files(ARCHIVE_DIR, days=ARCHIVE_RETENTION_DAYS)
    cleanup_old_files(ARCHIVE_RAW_DIR, days=ARCHIVE_RETENTION_DAYS)

    update_parser_status("ok", capture)
    logger.info("Archive Parser cycle completed successfully.")
    return True


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.StreamHandler()
        ]
    )
    success = run_archive_parser()
    sys.exit(0 if success else 1)
