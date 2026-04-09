import re
import logging
from bs4 import BeautifulSoup
from datetime import datetime

logger = logging.getLogger("SSSK-TextParser")

# Standard groups supported by the system
ALL_GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]

def apply_text_overrides(queues, html):
    """
    Parses HTML content for textual messages like 'підчерга 2.2 — відключення до 16:00'
    and applies these overrides to the existing queues grid (binary strings).
    """
    if not html or not queues:
        return queues

    soup = BeautifulSoup(html, 'html.parser')
    # Focus on the main content area (usually where the messages are)
    content = soup.find(id="content") or soup.find(class_="page-content") or soup
    text_blocks = content.get_text(separator="\n").split("\n")

    overrides_found = 0
    now = datetime.now()
    current_hour = now.hour

    for block in text_blocks:
        block = block.strip().lower()
        if not block: continue

        # 1. Detect Queue (e.g., "підчерга 2.2" or "черга 1.1")
        # Matches 1.1, 1,1, 11 (normalized to 1.1)
        queue_match = re.search(r"(?:підчерг[аі]|черг[аі])\s*([\d\.,]{1,3})", block)
        if not queue_match: continue

        raw_gid = queue_match.group(1).replace(',', '.')
        # Normalize "22" to "2.2"
        if len(raw_gid) == 2 and raw_gid.isdigit():
            gid = f"{raw_gid[0]}.{raw_gid[1]}"
        elif "." not in raw_gid and len(raw_gid) == 1:
            # If user just says "черга 2", we assume all sub-queues (2.1, 2.2)? 
            # Or just ignore it? Usually they are specific (2.2).
            gid = raw_gid
        else:
            gid = raw_gid

        # Expand prefix if needed (e.g., "2" matches "2.1" and "2.2")
        target_groups = [g for g in ALL_GROUPS if g == gid or g.startswith(gid + ".")]
        if not target_groups: continue

        # 2. Detect Action and Time
        # Pattern: "триватиме до 16:00" or "до 16:00"
        end_match = re.search(r"до\s*(\d{1,2})[:\.](\d{2})", block)
        # Pattern: "з 14:00"
        start_match = re.search(r"з\s*(\d{1,2})[:\.](\d{2})", block)
        # Pattern: "о 14:00"
        at_match = re.search(r"о\s*(\d{1,2})[:\.](\d{2})", block)

        action = None
        if "відключення" in block or "електрична енергія буде відсутня" in block:
            action = "OFF"
        elif "відмінено" in block or "буде заживлена" in block or "світло з'явиться" in block:
            action = "ON"

        if not action:
            # Heuristic: if no keyword, and says "до ...", it's usually an extension of current state (OFF)
            if end_match: action = "OFF"
            else: continue

        for g in target_groups:
            if g not in queues: continue
            
            # Convert string to list for modification
            q_list = list(queues[g])

            if end_match and action == "OFF":
                h_end = int(end_match.group(1))
                # Set OFF from now (or previous start) until h_end
                # We assume the update applies from the current hour onwards
                for h in range(current_hour, min(h_end, 24)):
                    q_list[h] = "0"
                logger.info(f"Text Override: Group {g} OFF until {h_end}:00")
                overrides_found += 1

            if start_match and action == "OFF":
                h_start = int(start_match.group(1))
                h_end = 24
                if end_match: h_end = int(end_match.group(1))
                for h in range(h_start, min(h_end, 24)):
                    q_list[h] = "0"
                logger.info(f"Text Override: Group {g} OFF from {h_start}:00")
                overrides_found += 1
            
            if at_match and "розпочнеться" in block:
                h_at = int(at_match.group(1))
                # Usually it's an extension until some unknown end, but typically 2-3 hours
                # Let's set it OFF from h_at for at least the next few hours (safest approach)
                # Better: just set it OFF at that specific hour and next ones until change
                for h in range(h_at, min(h_at + 4, 24)): # Heuristic 4 hours
                     q_list[h] = "0"
                logger.info(f"Text Override: Group {g} starts OFF at {h_at}:00")
                overrides_found += 1

            queues[g] = "".join(q_list)

    if overrides_found > 0:
        logger.info(f"Applied {overrides_found} textual schedule overrides.")
    
    return queues
