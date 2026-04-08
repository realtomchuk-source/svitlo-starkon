import sys
import os
import requests
import io
import logging
from PIL import Image
logging.basicConfig(level=logging.INFO)

from modules.grid_vision import parse_grid_from_image

def test():
    # Today's image URL
    url = "https://hoe.com.ua/Content/Uploads/2026/04/file20260408095429363.png"
    print(f"Downloading {url}...")
    resp = requests.get(url)
    if resp.status_code != 200:
        print("Failed to download image")
        return
    
    img_bytes = resp.content
    print("Parsing grid (with debug)...")
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    w, h = img.size
    grid_left = int(w * 0.12)
    grid_top = int(h * 0.10)
    cell_w = (w * 0.86) / 24
    cell_h = (h * 0.85) / 12
    
    print(f"Image size: {w}x{h}")
    # Sample 2.1 at hour 10 (should be orange)
    row = 2 # 2.1 is the 3rd row (0, 1, 2)
    col = 10
    cx = grid_left + int(col * cell_w + cell_w/2)
    cy = grid_top + int(row * cell_h + cell_h/2)
    rgb = img.getpixel((cx, cy))
    print(f"Sample at row {row}, col {col} (Coord {cx},{cy}): RGB {rgb}")
    
    queues = parse_grid_from_image(img_bytes)
    
    if not queues:
        print("Vision parsing failed entirely")
        return
    
    print("\nParsed Queues (24 hours):")
    for q, bits in queues.items():
        print(f"{q}: {bits}")

if __name__ == "__main__":
    # Add src to path for imports
    sys.path.append(os.path.abspath(os.path.dirname(__file__)))
    test()
