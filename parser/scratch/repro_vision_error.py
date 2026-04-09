import sys
import os
import numpy as np
from PIL import Image

# Setup paths
sys.path.append(os.path.join(os.getcwd(), 'parser', 'src'))
from modules.grid_vision import solve_grid, is_outage_color

# Target image
img_path = r"C:\Users\АТом\Desktop\Antigravity\SSSK\parser\data\raw_site\20260409_151300.png"

if not os.path.exists(img_path):
    print(f"Error: Image {img_path} not found.")
    sys.exit(1)

# Run vision engine
img = Image.open(img_path)
results = solve_grid(img)

print("Results for 09.04 (Updated):")
print(f"4.1: {results.get('4.1')}")
print(f"4.2: {results.get('4.2')}")

# Access internal line detections if possible, or just look at the saved debug_grid.png
# The solve_grid function saves debug_grid.png in the parser/src directory (or CWD)
print("Debug grid should be saved as 'debug_grid.png'")
