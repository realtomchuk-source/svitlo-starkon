import os
import requests
import hashlib
from bs4 import BeautifulSoup
from datetime import datetime
from PIL import Image
import io

# URL сторінки з графіками
OBL_URL = "https://hoe.com.ua/page/pogodinni-vidkljuchennja"

def get_image_hash(image_bytes):
    return hashlib.md5(image_bytes).hexdigest()

def run_site_parser(state):
    print("Parsing site...")
    try:
        response = requests.get(OBL_URL, timeout=30)
        response.raise_for_status()
    except Exception as e:
        print(f"Site access error: {e}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Пошук картинки графіка (XPath/Selector залежить від реального сайту)
    # Приклад: шукаємо img у div з певним класом або за назвою файлу
    img_tag = soup.find("img", src=lambda s: s and ("grafik" in s.lower() or "vidkljuchen" in s.lower()))
    
    if not img_tag:
        print("Schedule image not found on site.")
        return None

    img_url = img_tag['src']
    if not img_url.startswith("http"):
        img_url = "https://hoe.com.ua" + img_url

    try:
        img_resp = requests.get(img_url, timeout=30)
        img_resp.raise_for_status()
        img_bytes = img_resp.content
    except Exception as e:
        print(f"Image download error: {e}")
        return None

    new_hash = get_image_hash(img_bytes)
    last_hash = state.get("last_site_hash")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_path = f"data/raw_site/{timestamp}.png"
    
    # Зберігаємо завжди для Data Lake
    with open(raw_path, "wb") as f:
        f.write(img_bytes)
        
    # Зберігаємо HTML для Data Lake
    with open(f"data/raw_site/{timestamp}.html", "w", encoding="utf-8") as f:
        f.write(response.text)

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
