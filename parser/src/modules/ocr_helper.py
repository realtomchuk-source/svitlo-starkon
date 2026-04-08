import pytesseract
from PIL import Image
import io
import os
from modules.image_preprocessor import preprocess_for_ocr

if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def extract_text_from_image(img_bytes, preprocess=True):
    try:
        img = Image.open(io.BytesIO(img_bytes))

        if preprocess:
            img = preprocess_for_ocr(img)

        text = pytesseract.image_to_string(img, lang="ukr+eng")
        return text
    except Exception as e:
        print(f"OCR Error: {e}")
        return ""
