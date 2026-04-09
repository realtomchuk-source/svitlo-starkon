import os
import sys
from PIL import Image
import io

# Add parser/src to path
sys.path.insert(0, os.path.join(os.getcwd(), 'parser', 'src'))

from modules.grid_vision import is_outage_color, parse_grid_from_image

img_path = 'scratch/test_img.png'

print(f"Analyzing {img_path}...")

with open(img_path, 'rb') as f:
    img_bytes = f.read()

# Run actual parser logic
# Mocking return values to inspect lines
import modules.grid_vision as gv

img = Image.open(img_path).convert("RGB")
w, h = img.size

v_lines = gv.find_vertical_lines(img, w, h, gv.is_dark_pixel, threshold_ratio=0.5)
target_v = gv.find_best_block(v_lines, 25)
print(f"Target V Lines: {target_v}")

if target_v:
    h_lines = gv.find_horizontal_lines(img, h, target_v[0], target_v[-1], gv.is_dark_pixel, threshold_ratio=0.2, sample_step=8)
    target_h = gv.find_best_block(h_lines, 13)
    print(f"Target H Lines: {target_h}")
else:
    print("No V lines found")

queues = parse_grid_from_image(img_bytes)

if queues:
    print("\nParsed Queues (Sample):")
    for g in sorted(queues.keys())[:2]:
        print(f"Group {g}: {queues[g]}")
else:
    print("\nFAILED TO PARSE GRID.")

# --- DIAGNOSTIC: Sample arbitrary pixels that look blue ---
# In modern hoe.com.ua images, blue outages are around (150, 180, 220)
img = Image.open(img_path).convert("RGB")
w, h = img.size
print(f"\nImage Mode: {img.mode}, Size: {w}x{h}")

# Sample a grid center to see typical colors
print("\nColor samples at various coordinates:")
for y in range(h // 4, 3 * h // 4, h // 5):
    for x in range(w // 4, 3 * w // 4, w // 5):
        rgb = img.getpixel((x, y))
        outage = is_outage_color(rgb)
        print(f"Pos ({x}, {y}): RGB={rgb}, Sum={sum(rgb)}, IsOutage={outage}")

# Specific search for blue-ish pixels
print("\nScanning for blue-ish pixels (b > r + 10)...")
blue_found = 0
for y in range(h):
    for x in range(w):
        r, g, b = img.getpixel((x, y))
        if b > r + 10 and b > 140:
            if blue_found < 5:
                print(f"Blue pixel at ({x}, {y}): RGB=({r},{g},{b}), OutageCheck={is_outage_color((r,g,b))}")
            blue_found += 1
print(f"Total blue-ish pixels found: {blue_found}")
