import os
import sys
import logging

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), 'parser', 'src')))

from modules.grid_vision import parse_grid_from_image
from modules.table_parser import validate_queues

logging.basicConfig(level=logging.INFO)

# Absolute paths for reliability
base = os.path.abspath(os.path.join(os.getcwd(), 'parser', 'data', 'raw_site'))
files = [
    os.path.join(base, 'hist_1903_20260408_200611.png'),
    os.path.join(base, 'hist_1903_20260408_200944.png'),
    os.path.join(base, 'hist_2003_20260408_200608.png'),
    os.path.join(base, 'hist_2003_20260408_200941.png')
]

for f in files:
    print(f"\n--- Testing {f} ---")
    if not os.path.exists(f):
        print("  File not found")
        continue
    with open(f, 'rb') as f_in:
        img_bytes = f_in.read()
    
    queues = parse_grid_from_image(img_bytes)
    if queues and validate_queues(queues):
        print(f"  [SUCCESS] Found {len(queues)} queues")
        # Print a sample
        q_item = list(queues.keys())[0]
        print(f"    {q_item}: {queues[q_item]}")
    else:
        print("  [FAILED]")
