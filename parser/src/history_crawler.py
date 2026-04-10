import os
import sys
import re
import json
import time
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin

# Add src to path for modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.utils import load_json, save_json, get_now
from modules.table_parser import validate_queues
from modules.grid_vision import parse_grid_from_image
from modules.text_parser import apply_text_overrides
from config import UNIFIED_DB, HEADERS, RAW_SITE_DIR

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SSSK-HistoryCrawler")

NEWS_URL = "https://hoe.com.ua/post/novini-kompaniji"
BASE_URL = "https://hoe.com.ua"

MONTH_MAP_UKR = {
    "січня": "01", "лютого": "02", "березня": "03", "квітня": "04",
    "травня": "05", "червня": "06", "липня": "07", "серпня": "08",
    "вересня": "09", "жовтня": "10", "листопада": "11", "грудня": "12"
}

# URL slug month names (e.g., "kvitnja" -> "04")
MONTH_MAP_SLUG = {
    "sichnja": "01", "ljutogo": "02", "bereznja": "03", "kvitnja": "04",
    "travnja": "05", "chervnja": "06", "lipnja": "07", "serpnja": "08",
    "veresnja": "09", "zhovtnja": "10", "listopada": "11", "grudnja": "12"
}


def parse_date_from_title(title):
    """Extract date DD.MM from title like 'Графіки обмежень на 8 квітня' or 'Обмеження на 3 квітня'."""
    # Pattern: ... на <day> <month_word> ...
    match = re.search(r'на\s+(\d{1,2})\s+(\w+)', title.lower())
    if match:
        day = match.group(1).zfill(2)
        month_word = match.group(2)
        month = MONTH_MAP_UKR.get(month_word)
        if month:
            return f"{day}.{month}"

    # Pattern: ... на DD.MM ...
    match = re.search(r'на\s+(\d{1,2})\.(\d{1,2})', title)
    if match:
        day = match.group(1).zfill(2)
        month = match.group(2).zfill(2)
        return f"{day}.{month}"

    return None


def parse_date_from_url(url):
    """Extract date from URL slug like '/post/grafiki-obmezhen-na-8-kvitnja.html'."""
    match = re.search(r'na-(\d{1,2})-(\w+?)(?:\.html|$)', url.lower())
    if match:
        day = match.group(1).zfill(2)
        month_slug = match.group(2)
        month = MONTH_MAP_SLUG.get(month_slug)
        if month:
            return f"{day}.{month}"
    return None


def is_schedule_post(title):
    """Check if the news title is about a schedule or outage restrictions."""
    t = title.lower()
    keywords = ["графік", "відключ", "обмеж"]
    return any(kw in t for kw in keywords)


def get_news_links(max_pages=2):
    """Scrape HOE news listing for schedule-related posts."""
    links = []
    for page_num in range(1, max_pages + 1):
        url = f"{NEWS_URL}?page={page_num}" if page_num > 1 else NEWS_URL
        logger.info(f"Fetching news list: {url}")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.encoding = 'utf-8'
            soup = BeautifulSoup(resp.text, 'html.parser')

            articles = soup.select('article.item')
            if not articles:
                logger.warning(f"No <article class='item'> found on page {page_num}")
                break

            for article in articles:
                heading_div = article.select_one('div.heading a')
                if not heading_div:
                    continue

                title = heading_div.get_text(strip=True)
                link = heading_div.get('href', '')

                if not is_schedule_post(title):
                    continue

                # Try to extract date from title first, then from URL
                date = parse_date_from_title(title) or parse_date_from_url(link)

                if not link.startswith('http'):
                    link = urljoin(BASE_URL, link)

                # Also grab the thumbnail image URL directly from the listing
                img_tag = article.select_one('div.thumb img')
                img_url = None
                if img_tag:
                    img_src = img_tag.get('src', '')
                    if img_src:
                        img_url = urljoin(BASE_URL, img_src) if not img_src.startswith('http') else img_src

                links.append({
                    "title": title,
                    "link": link,
                    "date": date,
                    "img_url": img_url
                })
                logger.info(f"  Found: '{title}' -> date={date}, link={link}")

        except Exception as e:
            logger.error(f"Error fetching page {page_num}: {e}")

    return links


def extract_text_from_post(post_url):
    """Open the post page and extract plain text from div.post."""
    try:
        resp = requests.get(post_url, headers=HEADERS, timeout=30)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')

        post_div = soup.select_one('div.post')
        if post_div:
            # We want to preserve newlines for text_parser
            return post_div.get_text(separator='\n')
    except Exception as e:
        logger.error(f"Error extracting text from {post_url}: {e}")
    return None


def extract_images_from_post(post_url):
    """Open the post page and find ALL schedule images inside div.post.
    
    Returns list of image URLs. Posts may contain multiple images 
    (e.g. updates with text + schedule below).
    """
    images = []
    try:
        resp = requests.get(post_url, headers=HEADERS, timeout=30)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')

        # The schedule image is inside <div class="post"> -> <img src="/Content/Uploads/...">
        post_div = soup.select_one('div.post')
        if post_div:
            for img in post_div.find_all('img'):
                src = img.get('src', '')
                if '/content/uploads/' in src.lower():
                    if src.lower().endswith(('.png', '.jpg', '.jpeg')):
                        full_url = urljoin(post_url, src) if not src.startswith('http') else src
                        if full_url not in images:
                            images.append(full_url)

        # Fallback: any non-logo image in uploads on the page
        if not images:
            for img in soup.find_all('img'):
                src = img.get('src', '')
                if '/content/uploads/' in src.lower() and 'logo' not in src.lower():
                    if src.lower().endswith(('.png', '.jpg', '.jpeg')):
                        full_url = urljoin(post_url, src) if not src.startswith('http') else src
                        if full_url not in images:
                            images.append(full_url)

        if images:
            logger.info(f"  Found {len(images)} image(s) in post")
    except Exception as e:
        logger.error(f"Error fetching post {post_url}: {e}")
    return images


def process_history(limit_days=7):
    logger.info(f"=== Starting history crawler (target: last {limit_days} days) ===")

    links = get_news_links(max_pages=2)
    logger.info(f"Found {len(links)} schedule-related posts.")

    if not links:
        logger.warning("No schedule posts found. Check CSS selectors or network.")
        return

    db = load_json(UNIFIED_DB, default=[])
    existing_dates = {entry.get("date") for entry in db if entry.get("processed")}
    logger.info(f"Already in DB (processed): {existing_dates}")

    processed_count = 0
    for item in links:
        if not item.get("date"):
            logger.warning(f"Skipping '{item['title']}' — could not extract date")
            continue

        try:
            logger.info(f"Processing {item['date']} from '{item['title']}'...")

            # NEW: Extract body text to check for podcherga cancellations
            news_text = extract_text_from_post(item["link"])
            
            # Find existing entry in DB to see if we need to update it
            # CRITICAL: Find the LATEST (most recent) entry, not the first one.
            existing_entry = next((e for e in reversed(db) if e.get("target_date") == item["date"]), None)
            
            if existing_entry and news_text:
                # REPAIR LOGIC: If entry is missing queues_raw, it's from the old format.
                # To fix the "dirty" queues, we MUST re-process from image.
                # We also check if it's the current/tomorrow date to focus on active ones.
                is_stale_format = "queues_raw" not in existing_entry and existing_entry.get("source") == "site"
                
                if is_stale_format:
                    logger.info(f"  🔔 Entry for {item['date']} is OLD FORMAT (dirty). Removing to re-process cleanly.")
                    db.remove(existing_entry)
                    if item["date"] in existing_dates:
                        existing_dates.remove(item["date"])
                    existing_entry = None  # Force full re-processing below
                else:
                    # Apply text updates to EXISTING entry as usual
                    logger.info(f"  Checking text updates for existing entry {item['date']}...")
                    # We MUST use queues_raw as base if available, otherwise we use dirty queues (fallback)
                    base_queues = existing_entry.get("queues_raw", existing_entry.get("queues", {})).copy()
                    
                    updated_queues, new_announcements = apply_text_overrides(
                        base_queues, news_text, item["date"]
                    )
                    
                    old_announcements = existing_entry.get("announcements", [])
                    # Compare content (using sorted keys for robustness)
                    if str(new_announcements) != str(old_announcements):
                        logger.info(f"  🔔 Found NEW text announcements for {item['date']}!")
                        existing_entry["announcements"] = new_announcements
                        existing_entry["queues"] = updated_queues
                        existing_entry["timestamp"] = get_now().isoformat()
                        existing_entry["updated_by"] = "text_digest"
                        processed_count += 1
                    
                    # If date is already processed, we skip full image check unless it's a new image
                    if item["date"] in existing_dates:
                        continue

            # Original Image Logic
            img_urls = extract_images_from_post(item["link"])

            if not img_urls:
                logger.warning(f"No images found for {item['date']}")
                continue

            # Try each image until we find one that grid_vision can parse
            success = False
            for img_idx, img_url in enumerate(img_urls):
                try:
                    logger.info(f"  Trying image {img_idx + 1}/{len(img_urls)}: {img_url}")
                    img_bytes = requests.get(img_url, headers=HEADERS, timeout=30).content
                    logger.info(f"  Downloaded: {len(img_bytes)} bytes")

                    # Save raw image
                    timestamp = get_now().strftime("%Y%m%d_%H%M%S")
                    os.makedirs(RAW_SITE_DIR, exist_ok=True)
                    raw_path = os.path.join(RAW_SITE_DIR, f"hist_{item['date'].replace('.', '')}_{timestamp}.png")
                    with open(raw_path, "wb") as f:
                        f.write(img_bytes)

                    # Run grid vision analysis
                    logger.info("  Running grid vision analysis...")
                    queues = parse_grid_from_image(img_bytes)

                    is_valid = queues is not None and validate_queues(queues)

                    if is_valid:
                        # NEW: Capture raw queues before any potential overrides
                        queues_raw = queues.copy()
                        announcements = []
                        
                        if news_text:
                             logger.info(f"  Applying text overrides to NEW {item['date']} entry...")
                             queues, announcements = apply_text_overrides(queues, news_text, item["date"])

                        new_entry = {
                            "date": item["date"],
                            "target_date": item["date"],
                            "source": "site_history",
                            "type": "schedule",
                            "processed": True,
                            "timestamp": get_now().isoformat(),
                            "source_url": item["link"],
                            "raw_path": raw_path,
                            "queues": queues,
                            "queues_raw": queues_raw,
                            "announcements": announcements
                        }
                        db.append(new_entry)
                        processed_count += 1
                        existing_dates.add(item["date"])
                        logger.info(f"  ✅ Successfully processed {item['date']} ({len(queues)} queues)")
                        success = True
                        break  # Don't try more images for this date
                    else:
                        logger.info(f"  Image {img_idx + 1} failed vision, trying next...")

                except Exception as e:
                    logger.error(f"Error with image {img_idx + 1}: {e}")

            if not success:
                # Record failure
                db.append({
                    "date": item["date"],
                    "target_date": item["date"],
                    "source": "site_history",
                    "type": "schedule",
                    "processed": False,
                    "timestamp": get_now().isoformat(),
                    "source_url": item["link"],
                    "queues": {}
                })
                logger.warning(f"  ❌ All {len(img_urls)} images failed for {item['date']}")

        except Exception as e:
            logger.error(f"Error processing {item['date']}: {e}")

        # Rate limit
        time.sleep(1.5)

        if processed_count >= limit_days:
            break

    # Save updated DB
    save_json(UNIFIED_DB, db)
    logger.info(f"=== History crawl complete. New successful entries: {processed_count} ===")
    logger.info(f"Total DB entries: {len(db)}")


if __name__ == "__main__":
    process_history(limit_days=7)
