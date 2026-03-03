import os
import requests
import hashlib
from bs4 import BeautifulSoup
from datetime import datetime
from PIL import Image
import io

# URL сторінки з графіками
OBL_URL = "https://hoe.com.ua/page/pogodinni-vidkljuchennja"
HEADERS = {"User-Agent": "SSSK-Monitor/1.0"}

def get_image_hash(image_bytes):
    return hashlib.md5(image_bytes).hexdigest()

def run_site_parser(state):
    print("Parsing site...")
    try:
        response = requests.get(OBL_URL, timeout=30, headers=HEADERS)
        response.raise_for_status()
    except Exception as e:
        print(f"Site access error: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Пошук картинки графіка
    # На hoe.com.ua зазвичай це перша картинка в блоці .page-content або перша велика картинка
    img_tag = None
    
    # Спробуємо знайти в основному контейнері
    content = soup.find('div', class_='page-content') or soup.find('article') or soup.find('main')
    if content:
        img_tag = content.find('img')
    
    # Резервний пошук: перша картинка, що не є логотипом
    if not img_tag:
        for img in soup.find_all('img'):
            src = img.get('src', '').lower()
            if 'logo' not in src and 'icon' not in src:
                img_tag = img
                break
    
    if not img_tag:
        print("Schedule image not found on site.")
        return None

    img_url = img_tag['src']
    if not img_url.startswith("http"):
        img_url = "https://hoe.com.ua" + img_url

    try:
        img_resp = requests.get(img_url, timeout=30, headers=HEADERS)
        img_resp.raise_for_status()
        img_bytes = img_resp.content
    except Exception as e:
        print(f"Image download error: {e}")
        return None

    new_hash = get_image_hash(img_bytes)
    last_hash = state.get("last_site_hash")

    from modules.utils import get_now
    timestamp = get_now().strftime("%Y%m%d_%H%M%S")
    raw_path = f"data/raw_site/{timestamp}.png"
    
    # Створюємо папку, якщо її немає
    os.makedirs("data/raw_site", exist_ok=True)
    
    # Зберігаємо завжди для Data Lake
    with open(raw_path, "wb") as f:
        f.write(img_bytes)

    if new_hash == last_hash:
        print("Image hash match. No changes on site.")
        # Повертаємо None, бо змін немає, але мітку оновимо
        return {"changed": False, "raw_path": raw_path, "hash": new_hash}
    
    print("New image detected on site!")
    return {
        "changed": True,
        "raw_path": raw_path,
        "hash": new_hash,
        "img_bytes": img_bytes,
        "caption": img_tag.get("alt", "")
    }
