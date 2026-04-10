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
    Returns (updated_queues, list_of_announcements)
    """
    announcements = []
    if not html or not queues:
        return queues, announcements

    # 1. Split content into logical blocks (paragraphs or lines)
    soup = BeautifulSoup(html, 'html.parser')
    content = soup.find(id="content") or soup.find(class_="page-content") or soup
    raw_text = content.get_text(separator="\n")
    
    # Split by double newline or common separators to isolate news updates
    blocks = re.split(r'\n\s*\n', raw_text)

    overrides_found = 0
    context_day = None # Track the date across blocks if one is found
    
    for block in blocks:
        block = block.strip()
        if not block: continue
        
        # 2. Date Validation per block
        date_keywords = ["січня", "лютого", "березня", "квітня", "травня", "червня", 
                         "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]
        
        date_pattern = r"(?<!\d)(?<!черга )(?<!черги )(\d{1,2})[\.\s/]+(\d{1,2}|" + "|".join(date_keywords) + r")(?!\d)"
        
        date_match = re.search(date_pattern, block, re.IGNORECASE)
        if date_match:
            context_day = date_match.group(1).zfill(2)
            logger.debug(f"Found new date context: {context_day}")

        # If we have a context day and a target_date, enforce matching
        if context_day and target_date:
            target_day_only = target_date.split('.')[0].zfill(2)
            if context_day != target_day_only:
                logger.debug(f"Skipping block due to date mismatch: context={context_day}, target={target_day_only}")
                continue

        # 3. Deep Segmenting
        segments = re.split(r'\.(?!\d)|;|!|\n', block)
        
        for segment in segments:
            segment_clean = segment.strip()
            if not segment_clean: continue
            
            # Find all queues in this segment
            found_queues = []
            q_matches = re.finditer(r"(?:черг[аі]|підчерг[аі])?\s*([1-6][\.,][12])", segment_clean, re.IGNORECASE)
            for m in q_matches:
                gid = m.group(1).replace(',', '.')
                if gid in ALL_GROUPS:
                    found_queues.append(gid)
            
            if not found_queues: continue
            
            # Determine state
            action = None
            seg_lower = segment_clean.lower()
            if any(kw in seg_lower for kw in ["заживлена", "заживлено", "з'явиться світло", "відмінено", "скасовано", "без обмежень", "включено", "включена", "світло з'явилося", "заживлення"]):
                action = "ON"
            elif any(kw in seg_lower for kw in ["відключено", "відключена", "відключення", "триватиме", "знеструмлено", "знеструмлена", "буде відсутня", "обмеження", "вимкнено", "вимкнена", "зникне світло"]):
                action = "OFF"
            
            if not action: continue
            
            # Parse times
            intervals = []
            
            # 1. Range Pattern: 07:00-11:00 or 07-11
            time_matches = re.finditer(r'(?<![.\d])(\d{1,2})(?::00)?\s*[–—-]\s*(\d{1,2})(?::00)?(?![.\d])', segment_clean)
            for m in time_matches:
                s_val, e_val = int(m.group(1)), int(m.group(2))
                if s_val < 24 and e_val <= 24:
                    intervals.append({'s': s_val % 24, 'e': e_val % 24 or 24, 'type': 'range'})
            
            # 2. Pattern: з 07:00 до 11:00
            if not intervals:
                from_to_matches = re.finditer(r'з\s*(\d{1,2})(?::00)?\s*до\s*(\d{1,2})(?::00)?', segment_clean)
                for m in from_to_matches:
                    intervals.append({'s': int(m.group(1)) % 24, 'e': int(m.group(2)) % 24 or 24, 'type': 'range'})

            # 3. Single patterns: до 12:00 or з 15:00
            if not intervals:
                upto_matches = re.finditer(r'\bдо\b\s*(\d{1,2})(?::00)?', segment_clean)
                for m in upto_matches:
                    intervals.append({'s': 0, 'e': int(m.group(1)) % 24 or 24, 'type': 'upto'})
                
                from_matches = re.finditer(r'\b(?:з|о)\b\s*(\d{1,2})(?::00)?', segment_clean)
                for m in from_matches:
                    intervals.append({'s': int(m.group(1)) % 24, 'e': 24, 'type': 'from'})

            # Store detection for Admin Panel
            announcements.append({
                "queues": found_queues,
                "action": action,
                "intervals": intervals,
                "text": segment_clean[:200] + ("..." if len(segment_clean) > 200 else "")
            })

            # Apply to grid
            val = "1" if action == "ON" else "0"
            for g in found_queues:
                if g not in queues: continue
                q_list = list(queues[g])
                
                if intervals:
                    for item in intervals:
                        s, e = item['s'], item['e']
                        itype = item['type']
                        
                        if itype == 'range':
                            for h in range(s, e):
                                if 0 <= h < 24: q_list[h] = val
                        elif itype == 'upto':
                            # Extension logic: fill backwards from e to the start of the current block
                            # or at least the previous hour
                            current_h = e - 1
                            limit = 6 # Don't fill more than 6 hours back blindly
                            while current_h >= 0 and limit > 0:
                                was_zero = (q_list[current_h] == '0')
                                q_list[current_h] = val
                                if was_zero and current_h > 0: 
                                    # If we hit an existing zero, we've successfully "extended" the block
                                    break
                                current_h -= 1
                                limit -= 1
                        elif itype == 'from':
                            # From logic: fill forward
                            for h in range(s, min(24, s + 4)): # Default forward 4h if no end
                                q_list[h] = val
                    overrides_found += 1
                
                queues[g] = "".join(q_list)

    if overrides_found > 0:
        logger.info(f"Applied {overrides_found} textual schedule overrides.")
    
    return queues, announcements
