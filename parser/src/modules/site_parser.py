import os
import hashlib
import logging
import time
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync
from config import OBL_URL, RAW_SITE_DIR

logger = logging.getLogger("SSSK-SiteParser")

def get_image_hash(image_bytes):
    return hashlib.md5(image_bytes).hexdigest()

def fetch_page_dynamic(url):
    """Fetches the page content using Playwright to handle dynamic rendering."""
    logger.info(f"Fetching {url} with Playwright...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            stealth_sync(page)
            
            # Navigate and wait for content
            page.goto(url, wait_until="networkidle", timeout=60000)
            
            # Wait a bit more for potential late scripts
            time.sleep(2)
            
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        logger.error(f"Playwright fetch error: {e}")
        return None

def extract_image_url(html):
    """Extracts the schedule image URL from rendered HTML."""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Priority 1: Search for image with Uploads pattern inside content area
    content_areas = soup.find_all(['div', 'article', 'main'], class_=['page-content', 'content', 'main'])
    for area in content_areas:
        for img in area.find_all('img'):
            src = img.get('src', '')
            if '/Content/Uploads/' in src and ('.png' in src.lower() or '.jpg' in src.lower()):
                return src
    
    # Priority 2: Broad search for any Uploads image that looks like a schedule
    for img in soup.find_all('img'):
        src = img.get('src', '')
        alt = img.get('alt', '').lower()
        if '/Content/Uploads/' in src and ('графік' in alt or 'відключень' in alt):
            return src
            
    # Priority 3: First meaningful image in page-content
    content = soup.find('div', class_='page-content')
    if content:
        img = content.find('img')
        if img: return img.get('src')
        
    return None

def run_site_parser(state):
    logger.info("Starting site parser cycle...")
    
    html = fetch_page_dynamic(OBL_URL)
    if not html:
        logger.error("Failed to fetch rendered HTML. Aborting cycle.")
        return None

    img_url = extract_image_url(html)
    if not img_url:
        logger.warning("Schedule image not found in rendered HTML.")
        return None

    if not img_url.startswith("http"):
        from urllib.parse import urljoin
        img_url = urljoin(OBL_URL, img_url)

    logger.info(f"Target image URL: {img_url}")

    try:
        import requests
        from config import HEADERS
        img_resp = requests.get(img_url, timeout=30, headers=HEADERS)
        img_resp.raise_for_status()
        img_bytes = img_resp.content
    except Exception as e:
        logger.error(f"Image download error: {e}")
        return None

    new_hash = get_image_hash(img_bytes)
    last_hash = state.get("last_site_hash")

    from modules.utils import get_now
    timestamp = get_now().strftime("%Y%m%d_%H%M%S")
    raw_path = os.path.join(RAW_SITE_DIR, f"{timestamp}.png")
    
    os.makedirs(RAW_SITE_DIR, exist_ok=True)
    
    with open(raw_path, "wb") as f:
        f.write(img_bytes)

    if new_hash == last_hash:
        logger.info("Image hash match. No changes detected on site.")
        return {"changed": False, "raw_path": raw_path, "hash": new_hash}
    
    logger.info("NEW schedule image detected and downloaded!")
    return {
        "changed": True,
        "raw_path": raw_path,
        "hash": new_hash,
        "img_bytes": img_bytes,
        "caption": "Schedule image from site"
    }
