import os
import hashlib
import logging
import time
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth
from config import OBL_URL, RAW_SITE_DIR

logger = logging.getLogger("SSSK-SiteParser")

def get_hash(data_bytes_or_str):
    if isinstance(data_bytes_or_str, str):
        data_bytes_or_str = data_bytes_or_str.encode('utf-8')
    return hashlib.md5(data_bytes_or_str).hexdigest()

def check_site_light():
    """Швидка перевірка сторінки через requests (без браузера)."""
    import requests
    from config import OBL_URL, HEADERS
    try:
        resp = requests.get(OBL_URL, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            return get_hash(resp.text)
    except Exception as e:
        logger.error(f"Light check error: {e}")
    return None

def fetch_page_dynamic(url):
    """Fetches the page content using Playwright."""
    logger.info(f"Fetching {url} with Playwright...")
    try:
        with sync_playwright() as p:
            # Using browser with common desktop resolution
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={'width': 1280, 'height': 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            Stealth().apply_stealth_sync(page)
            
            page.goto(url, wait_until="networkidle", timeout=60000)
            time.sleep(3) # Wait for images to settle
            
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        logger.error(f"Playwright fetch error: {e}")
        return None

def extract_image_url(html):
    """Broad search for schedule image."""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Priority: Any image in /Content/Uploads/ with common extensions
    for img in soup.find_all('img'):
        src = img.get('src', '')
        # Usually it's the only one in Uploads except for the logo (which is typically named logo.png)
        if '/content/uploads/' in src.lower() and ('logo' not in src.lower()):
            if src.lower().endswith(('.png', '.jpg', '.jpeg')):
                return src
                
    return None

def run_site_parser(state):
    logger.info("Starting site parser cycle...")
    
    html = fetch_page_dynamic(OBL_URL)
    if not html:
        return None

    # 2. Extract specific image URL
    soup = BeautifulSoup(html, 'html.parser')
    img_url = extract_image_url(html)
    
    # 3. Extract news text for announcements (preserve structure)
    news_text = soup.get_text(separator='\n')
    news_text = '\n'.join([line.strip() for line in news_text.splitlines() if line.strip()])
    
    # 4. Check for "no outages" text
    is_empty = False
    if not img_url:
        soup = BeautifulSoup(html, 'html.parser')
        text = soup.get_text().lower()
        if "не прогнозує відключень" in text or "графік не застосовується" in text:
            logger.info("Official site says: NO OUTAGES predicted.")
            is_empty = True
        else:
            logger.warning("Schedule image not found and no 'No Outage' text detected.")
            return None

    if is_empty:
        # Generate an empty "power-on" result
        return {
            "changed": True,
            "is_empty": True,
            "raw_path": "site_empty",
            "hash": "empty",
            "caption": "No outages predicted today"
        }

    if not img_url.startswith("http"):
        from urllib.parse import urljoin
        img_url = urljoin(OBL_URL, img_url)

    logger.info(f"Target image URL: {img_url}")

    try:
        import requests
        from config import HEADERS
        img_bytes = requests.get(img_url, timeout=30, headers=HEADERS).content
    except Exception as e:
        logger.error(f"Image download error: {e}")
        return None

    new_hash = get_hash(img_bytes)
    html_hash = get_hash(html)
    
    last_hash = state.get("last_site_hash")
    last_html_hash = state.get("last_html_hash")

    from modules.utils import get_now
    timestamp = get_now().strftime("%Y%m%d_%H%M%S")
    raw_path = os.path.join(RAW_SITE_DIR, f"{timestamp}.png")
    os.makedirs(RAW_SITE_DIR, exist_ok=True)
    with open(raw_path, "wb") as f:
        f.write(img_bytes)

    changed = (new_hash != last_hash) or (html_hash != last_html_hash)
    
    return {
        "changed": changed,
        "raw_path": raw_path,
        "hash": new_hash,
        "html_hash": html_hash,
        "img_bytes": img_bytes,
        "html": html,
        "news_text": news_text,
        "caption": "Schedule updated (image or text)" if changed else "No changes"
    }
