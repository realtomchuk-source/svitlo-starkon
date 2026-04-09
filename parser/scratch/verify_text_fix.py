import sys
import os
import logging

# Configure logging to see text_parser output
logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')

src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.append(src_path)

from modules.text_parser import apply_text_overrides

# Simulation
queues = {
    "1.1": "1" * 24,
    "4.1": "1" * 24
}

# This is a typical "mixed" block from Oblenergo
# Note: I'm using a very explicit string here to avoid any hidden character issues
problematic_html = '<div><p>Електроенергію заживлено для черги 1.1 раніше графіка.</p><p>Черга 4.1: 07:00-11:00 - буде відключено згідно з графіком.</p></div>'

print("--- STARTING PARSER ---")
result = apply_text_overrides(queues.copy(), problematic_html, target_date="09.04")
print("--- PARSER FINISHED ---")

print(f"Queue 1.1: {result['1.1']}")
print(f"Queue 4.1: {result['4.1']}")

# Verification
if result['1.1'][0] == '1':
    print("SUCCESS: 1.1 stayed ON")
else:
    print("FAILURE: 1.1 flipped to OFF?")

# 4.1 check
sub = result['4.1'][7:11]
if sub == '0000':
    print(f"SUCCESS: 4.1 correctly set to OFF (07-11) -> {sub}")
else:
    print(f"FAILURE: 4.1 has {sub} instead of 0000")
