import sys
import os
import io
from PIL import Image

# Add the 'src' directory to the path
src_path = r"C:\Users\АТом\Desktop\Antigravity\SSSK\parser\src"
sys.path.append(src_path)

import modules.grid_vision as gv
from modules.grid_vision import parse_grid_from_image, is_outage_color

# Diagnostic version of is_outage_color
original_is_outage = gv.is_outage_color
def diagnostic_is_outage(rgb):
    res = original_is_outage(rgb)
    # We want to know why 07-10 fails for row 4.1.
    # We don't have row context here, but we can print all blue-ish pixels
    r,g,b = rgb
    if b > 100 and b > r:
         # print(f"DEBUG RGB: {rgb} -> {res}")
         pass
    return res

gv.is_outage_color = diagnostic_is_outage

# Target image
img_path = r"C:\Users\АТом\Desktop\Antigravity\SSSK\parser\data\raw_site\20260409_151300.png"

with open(img_path, "rb") as f:
    img_bytes = f.read()

# Inspect pixels directly for row 4.1 hour 7
img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
# We need to find the grid first to know where row 4.1 is
# Let's just run parse and look at the logs if we add them
results = parse_grid_from_image(img_bytes)

print(f"Results 4.1: {results.get('4.1')}")
