import os
import json
import hashlib
import requests
from PIL import Image

# URL сайту Хмельницькобленерго
SOURCE_URL = "https://hoe.com.ua/page/pogodinni-vidkljuchennja"

# Telegram конфігурація (буде братися з GitHub Secrets)
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def send_telegram(message):
    """Надсилає повідомлення в Telegram бот"""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print(f"Skipping Telegram: {message}")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML"
        })
    except Exception as e:
        print(f"Помилка Telegram: {e}")

# Константи калібровки (на основі ваших замірів в Paint)
GRID = {
    'origin_x': 189,
    'origin_y': 350,
    'cell_w': 60,
    'cell_h': 54,
}

# Назви підчерг (12 рядків)
SUBGROUPS = [
    "1.1", "1.2", "2.1", "2.2", "3.1", "3.2", 
    "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
]

def get_image_hash(image_path):
    """Рахує SHA256 хеш файлу"""
    hasher = hashlib.sha256()
    with open(image_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def is_off(pixel):
    """
    Визначає, чи є піксель кольором 'ВІДКЛЮЧЕНО'.
    Для Хмельницькобленерго це зазвичай відтінки синього/фіолетового.
    """
    r, g, b = pixel
    # Зазвичай у файлах відключення мають низький рівень Green та високий Blue
    return r < 150 and b > 100 

def sample_zone(img, cx, cy, size=3):
    """Зонне семплювання 3х3 для точного визначення кольору"""
    pixels = []
    for dx in range(-size, size + 1):
        for dy in range(-size, size + 1):
            pixels.append(img.getpixel((cx + dx, cy + dy)))
    
    off_count = sum(1 for p in pixels if is_off(p))
    return off_count > len(pixels) // 2

def parse_image(image_path):
    img = Image.open(image_path).convert('RGB')
    print(f"Розмір зображення: {img.size}")

    result = {}
    for i, subgroup_name in enumerate(SUBGROUPS):
        off_hours = []
        for hour in range(24):
            # Розрахунок центру клітинки
            cx = GRID['origin_x'] + hour * GRID['cell_w']
            cy = GRID['origin_y'] + i * GRID['cell_h']
            
            if sample_zone(img, cx, cy):
                off_hours.append(hour)
        
        result[subgroup_name] = off_hours
    
    return result

def run_pipeline():
    # 1. Спробуємо знайти або завантажити картинку (поки використовуємо локальну для тестування структури)
    sample_path = "sample.png"
    
    if not os.path.exists(sample_path):
        print(f"❌ Помилка: Файл {sample_path} не знайдено.")
        return

    # 2. Хешування (щоб знати, чи змінився графік)
    current_hash = get_image_hash(sample_path)
    print(f"SHA256: {current_hash}")

    # 3. Парсинг
    print(f"Парсинг {sample_path}...")
    try:
        data = parse_image(sample_path)
        
        # 4. Формування результату (JSON)
        output = {
            "last_updated": current_hash,
            "schedule": data
        }
        
        # 5. Збереження
        os.makedirs("data", exist_ok=True)
        with open("data/current.json", "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Результат успішно збережено в data/current.json")
        
    except Exception as e:
        print(f"❌ Помилка під час парсингу: {e}")

if __name__ == "__main__":
    run_pipeline()
