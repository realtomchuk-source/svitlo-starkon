import re
import logging

logger = logging.getLogger("SSSK-TableParser")

ALL_GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]


def extract_date(text):
    match = re.search(r"на\s+(\d{2}\.\d{2}\.\d{4})", text)
    if match:
        full = match.group(1)
        return full[:5], full
    match = re.search(r"на\s+(\d{2}\.\d{2})", text)
    if match:
        short = match.group(1)
        return short, short
    return None, None


def detect_mode(text):
    lower = text.lower()
    if "відключен" not in lower and "графік" not in lower:
        return "all_clear"
    if "термінов" in lower or "аварійн" in lower or "повне" in lower:
        return "no_power"
    return "schedule"


def parse_queue_line(line):
    match = re.match(r"^\s*(\d+\.\d+)[\.\s:]+(.*)", line)
    if not match:
        return None, None
    group_id = match.group(1).strip()
    values_str = match.group(2).strip()
    return group_id, values_str


def extract_hours_from_values(values_str):
    tokens = re.split(r"[\s|]+", values_str)
    tokens = [t.strip() for t in tokens if t.strip()]

    hours = []
    for token in tokens:
        if re.match(r"^\d+$", token):
            val = int(token)
            if val > 0:
                hours.append("0")
            else:
                hours.append("1")
        elif token.lower() in ["0", "00", "-", ""]:
            hours.append("1")
        else:
            hours.append("0")

    return hours


def parse_schedule_from_text(text):
    if not text or len(text.strip()) < 10:
        logger.warning("OCR text is too short or empty")
        return None

    date_short, date_full = extract_date(text)
    mode = detect_mode(text)

    if mode == "all_clear":
        queues = {g: "1" * 24 for g in ALL_GROUPS}
        return build_result(date_short, date_full, mode, queues)

    if mode == "no_power":
        queues = {g: "0" * 24 for g in ALL_GROUPS}
        return build_result(date_short, date_full, mode, queues)

    queues = {}
    lines = text.split("\n")

    for line in lines:
        group_id, values_str = parse_queue_line(line)
        if group_id and group_id in ALL_GROUPS and values_str:
            hours = extract_hours_from_values(values_str)
            if len(hours) >= 24:
                queues[group_id] = "".join(hours[:24])
            elif len(hours) > 0:
                queues[group_id] = "".join(hours).ljust(24, "1")

    if len(queues) < 4:
        logger.warning(f"Only {len(queues)} queues parsed, trying color analysis fallback")
        return None

    for g in ALL_GROUPS:
        if g not in queues:
            queues[g] = "1" * 24

    return build_result(date_short, date_full, mode, queues)


def build_result(date_short, date_full, mode, queues):
    return {
        "date": date_short or "",
        "date_full": date_full or "",
        "mode": mode,
        "message": f"Графік погодинних відключень на {date_full}" if date_full else "Графік погодинних відключень",
        "has_tomorrow": True,
        "queues": queues,
    }


def validate_queues(queues):
    if not queues:
        return False
    for g in ALL_GROUPS:
        if g not in queues:
            return False
        val = queues[g]
        if len(val) != 24:
            return False
        if not all(c in "01" for c in val):
            return False
    return True
