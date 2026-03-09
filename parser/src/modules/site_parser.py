import os
import requests
import hashlib
import logging
from bs4 import BeautifulSoup
from PIL import Image
import io
from config import OBL_URL, HEADERS, RAW_SITE_DIR

logger = logging.getLogger("SSSK-SiteParser")

def get_image_hash(image_bytes):
    return hashlib.md5(image_bytes).hexdigest()

def run_site_parser(state):
    logger.info("Parsing site hoe.com.ua...")
    try:
        response = requests.get(OBL_URL, timeout=30, headers=HEADERS)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Site access error: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Пошук картинки графіка
    img_tag = None
    content = soup.find('div', class_='page-content') or soup.find('article') or soup.find('main')
    if content:
        img_tag = content.find('img')
    
    if not img_tag:
        for img in soup.find_all('img'):
            src = img.get('src', '').lower()
            if 'logo' not in src and 'icon' not in src:
                img_tag = img
                break
    
    if not img_tag:
        logger.warning("Schedule image not found on site.")
        return None

    img_url = img_tag['src']
    if not img_url.startswith("http"):
        # Handle relative URLs correctly
        from urllib.parse import urljoin
        img_url = urljoin(OBL_URL, img_url)

    try:
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
        logger.info("Image hash match. No changes on site.")
        return {"changed": False, "raw_path": raw_path, "hash": new_hash}
    
    logger.info("New image detected on site!")
    return {
        "changed": True,
        "raw_path": raw_path,
        "hash": new_hash,
        "img_bytes": img_bytes,
        "caption": img_tag.get("alt", "")
    }
