import pytesseract
from PIL import Image
import io
import os

# Шлях до Tesseract для Windows (локальне налаштування)
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def extract_text_from_image(img_bytes):
    try:
        img = Image.open(io.BytesIO(img_bytes))
        # Оптимізація для таблиць (можливо знадобиться додаткова обробка)
        text = pytesseract.image_to_string(img, lang="ukr+eng")
        return text
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""
