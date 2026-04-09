import sys
import os
# Add the 'src' directory to the path
src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.append(src_path)

from modules.grid_vision import solve_grid, is_outage_color

# Mock numpy.linspace
def my_linspace(start, stop, num):
    if num == 1: return [start]
    step = (stop - start) / (num - 1)
    return [start + i * step for i in range(num)]

# We need to monkey-patch numpy if it's not present, or just fix the code
import modules.grid_vision as gv
import numpy as np
class MockNP:
    @staticmethod
    def linspace(start, stop, num):
        if num == 1: return [start]
        step = (stop - start) / (num - 1)
        return [float(start + i * step) for i in range(num)]

gv.np = MockNP()

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
