import sys
import os
from PIL import Image
import pytesseract
import io

# Додаємо шлях до модулів
sys.path.append(os.path.abspath("scripts"))
from modules.ocr_helper import extract_text_from_image

def test_ocr():
    print("--- OCR Local Test ---")
    sample_path = "sample.png" # Використовуємо файл з кореня проекту
    
    if not os.path.exists(sample_path):
        print(f"Error: {sample_path} not found.")
        return

    print(f"Reading {sample_path}...")
    try:
        with open(sample_path, "rb") as f:
            img_bytes = f.read()
            
        text = extract_text_from_image(img_bytes)
        
        print("\n--- Extracted Text (First 500 chars) ---")
        print(text[:500])
        print("-----------------------------------------")
        
        if "на" in text.lower() or "графік" in text.lower() or "черг" in text.lower():
            print("\n✅ Success: Text recognized correctly!")
        else:
            print("\n⚠️ Warning: Text recognized but might be garbled. Check if ukr.traineddata is in the right folder.")
            
    except Exception as e:
        print(f"❌ Error during OCR: {e}")

if __name__ == "__main__":
    test_ocr()
