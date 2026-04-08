import re
import logging

logger = logging.getLogger("SSSK-TableParser")

ALL_GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]

def normalize_group_id(gid):
    """Normalizes group IDs like '11' -> '1.1' or '22' -> '2.2' if needed."""
    gid = str(gid).strip().replace(',', '.')
    if re.match(r'^[1-6][12]$', gid):
        return f"{gid[0]}.{gid[1]}"
    return gid

def extract_date(text):
    # Try long format first: 08.04.2024
    match = re.search(r"на\s+(\d{2}\.\d{2}\.\d{4})", text)
    if match:
        full = match.group(1)
        return full[:5], full
    # Try short format: 08.04
    match = re.search(r"на\s+(\d{2}\.\d{2})", text)
    if match:
        short = match.group(1)
        return short, f"{short}.2026" # Assume current year if missing
    return None, None

def detect_mode(text):
    lower = text.lower()
    # If explicitly says "No outages"
    if "не прогнозує" in lower or "без відключен" in lower:
        return "all_clear"
    # Logic for emergency
    if "термінов" in lower or "аварійн" in lower:
        return "no_power"
    return "schedule"

def parse_queue_line(line):
    # More robust line parsing: any sequence of digits or chars that looks like a group
    line = line.strip()
    if not line: return None, None
    
    # Try to find something that looks like "1.1" or "11" at start
    match = re.match(r"^\s*([\d\.,]{2,3})[\s\.:|-]+(.*)", line)
    if not match:
        # Fallback: maybe just "1.1 0 0 1..."
        match = re.match(r"^([1-6][\.,][12]|[1-6][12])\s+(.*)", line)
        if not match: return None, None
    
    group_id = normalize_group_id(match.group(1))
    values_str = match.group(2).strip()
    return group_id, values_str

def extract_hours_from_values(values_str):
    # OCR might read '0' as 'o' or 'O', '1' as 'I' or '|'
    cleaned = values_str.replace('o', '0').replace('O', '0').replace('I', '1').replace('|', '1')
    # Treat anything not digit/space as noise or separator
    tokens = re.split(r"[\s\.,:;|/]+", cleaned)
    tokens = [t.strip() for t in tokens if t.strip()]

    hours = []
    for token in tokens:
        # If token is multiple digits like "000", split them
        if len(token) > 1 and re.match(r"^\d+$", token):
            for char in token:
                hours.append("0" if int(char) > 0 else "1")
        elif re.match(r"^\d$", token):
            val = int(token)
            # In some tables 0 is power off, in others it's the value. 
            # Usually: 0 means NO LIMIT, >0 means LIMIT.
            # But the site graphics usually use colors.
            # If we see 0, 1, 0, 1... usually it's binary.
            hours.append("0" if val > 0 else "1")
        elif token == "-":
            hours.append("1")
    
    return hours

from modules.grid_vision import parse_grid_from_image

def parse_schedule_from_text(text, img_bytes=None):
    if not text or len(text.strip()) < 10:
        logger.warning("OCR text is too short or empty")
        # If we have image bytes, we can still try vision parsing
        if not img_bytes: return None

    date_short, date_full = extract_date(text)
    mode = detect_mode(text)

    if mode == "all_clear":
        queues = {g: "1" * 24 for g in ALL_GROUPS}
        return build_result(date_short, date_full, mode, queues)

    queues = {}
    
    # 1. ALWAYS TRY VISION FIRST if available (it is now more reliable than OCR for grid)
    if img_bytes:
        vision_queues = parse_grid_from_image(img_bytes)
        if vision_queues and len(vision_queues) >= 12:
            logger.info("Successfully parsed grid using Vision")
            queues = vision_queues

    # 2. FALLBACK TO OCR if Vision failed
    if not queues:
        logger.info("Falling back to OCR for grid parsing")
        lines = text.split("\n")
        for line in lines:
            group_id, values_str = parse_queue_line(line)
            if group_id and group_id in ALL_GROUPS:
                hours = extract_hours_from_values(values_str)
                if len(hours) >= 24:
                    queues[group_id] = "".join(hours[:24])
                elif len(hours) > 0:
                    queues[group_id] = "".join(hours).ljust(24, "1")

    # If we failed both
    if len(queues) < 3:
        logger.warning(f"Failed to parse queues (Vision/OCR). Found {len(queues)}")
        return None

    # Fill missing queues with default "always on"
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
    if not queues: return False
    for g in ALL_GROUPS:
        if g not in queues: return False
        val = queues[g]
        if len(val) != 24: return False
        if not all(c in "01" for c in val): return False
    return True
