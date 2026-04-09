import re
import logging
from bs4 import BeautifulSoup
from datetime import datetime

logger = logging.getLogger("SSSK-TextParser")

# Standard groups supported by the system
ALL_GROUPS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]

def apply_text_overrides(queues, html, target_date=None):
    """
    Parses HTML content for textual messages and applies overrides only if the date matches.
    """
    if not html or not queues:
        return queues

    # 1. Split content into logical blocks (paragraphs or lines)
    soup = BeautifulSoup(html, 'html.parser')
    content = soup.find(id="content") or soup.find(class_="page-content") or soup
    raw_text = content.get_text(separator="\n")
    
    # Split by double newline or common separators to isolate news updates
    blocks = re.split(r'\n\s*\n', raw_text)

    overrides_found = 0
    now = datetime.now()
    
    for block in blocks:
        block = block.strip()
        if not block: continue
        
        # 2. Date Validation per block
        # We need to extract the date from this specific block if possible
        date_keywords = ["січня", "лютого", "березня", "квітня", "травня", "червня", 
                         "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]
        # Use a more restrictive pattern to avoid matching queue numbers (like 1.1) as dates
        # Typically dates in news are "09.04" or "9 квітня"
        date_pattern = r"(?<!\d)(?<!черга )(?<!черги )(\d{1,2})[\.\s/]+(\d{1,2}|" + "|".join(date_keywords) + r")(?!\d)"
        
        date_match = re.search(date_pattern, block, re.IGNORECASE)
        if date_match and target_date:
            day_str = date_match.group(1).zfill(2)
            if not target_date.startswith(day_str):
                # logger.debug(f"Skipping block due to date mismatch: {day_str} vs {target_date}")
                continue

        # 3. Deep Segmenting: split the block into sentences/segments
        # This prevents a state keyword in sentence 1 from affecting queues in sentence 2
        # Use negative lookahead to avoid splitting on dots inside queue numbers like "1.1"
        segments = re.split(r'\.(?!\d)|;|!|\n', block)
        
        for segment in segments:
            segment = segment.strip().lower()
            if not segment: continue
            
            # Find all queues in this specific segment
            found_queues = []
            # Match formats: "1.1", "черга 1.1", "підчерга 1.1", "1.1 черг"
            q_matches = re.finditer(r"(?:черг[аі]|підчерг[аі])?\s*([1-6][\.,][12])", segment)
            for m in q_matches:
                gid = m.group(1).replace(',', '.')
                if gid in ALL_GROUPS:
                    found_queues.append(gid)
            
            if not found_queues: continue
            
            # Determine state for THIS segment
            action = None
            if any(kw in segment for kw in ["заживлена", "заживлено", "з'явиться світло", "відмінено", "скасовано", "без обмежень", "включено"]):
                action = "ON"
            elif any(kw in segment for kw in ["відключено", "знеструмлено", "буде відсутня", "обмеження"]):
                action = "OFF"
            
            if not action: continue
            
            # Parse times in THIS segment
            intervals = []
            # Pattern: 07:00-11:00 or 07-11 (supports various dashes)
            time_matches = re.findall(r'(\d{1,2})(?:[:.]00)?\s*[–—-]\s*(\d{1,2})(?:[:.]00)?', segment)
            for s_str, e_str in time_matches:
                intervals.append((int(s_str) % 24, int(e_str) % 24 or 24))
            
            # Pattern: з 07 до 11
            from_to_matches = re.findall(r'з\s*(\d{1,2})(?:[:.]00)?\s*до\s*(\d{1,2})(?:[:.]00)?', segment)
            for s_str, e_str in from_to_matches:
                intervals.append((int(s_str) % 24, int(e_str) % 24 or 24))

            if intervals:
                logger.info(f"Text Match: Queues {found_queues} {action} at {intervals}")

            # Apply
            val = "1" if action == "ON" else "0"
            for g in found_queues:
                if g not in queues: continue
                q_list = list(queues[g])
                
                # If intervals found, apply only those
                if intervals:
                    for s, e in intervals:
                        for h in range(s, e):
                            if 0 <= h < 24: q_list[h] = val
                        overrides_found += 1
                else:
                    # If NO intervals but the segment says "Queue X is ON/OFF"
                    # We might want to apply it for the current/remaining hour?
                    # For safety, we only touch specific hours if mentioned.
                    pass
                
                queues[g] = "".join(q_list)

    if overrides_found > 0:
        logger.info(f"Applied {overrides_found} textual schedule overrides.")
    
    return queues
