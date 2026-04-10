import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'parser', 'src'))

from modules.text_parser import apply_text_overrides

test_html = """
<div id="content">
    Уточнення на 10 квітня:
    підчерга 2.2 — відключення триватиме з 15:00 до 18:00
    підчерга 4.2 — відключення триватиме з 12:00 до 15:00
    підчерга 5.2 — відключення триватиме до 12:00

    На 11 квітня 2026:
    підчерга 2.1 — відключення триватиме з 06:00 до 08:00
</div>
"""

test_queues = {g: "1" * 24 for g in ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]}

print("Testing for 11.04...")
q, ann = apply_text_overrides(test_queues.copy(), test_html, "11.04")
print(f"Announcements found: {len(ann)}")
for a in ann:
    print(f" - {a['queues']} {a['action']} {a['intervals']}")

print("\nTesting for 10.04...")
q, ann = apply_text_overrides(test_queues.copy(), test_html, "10.04")
print(f"Announcements found: {len(ann)}")
for a in ann:
    print(f" - {a['queues']} {a['action']} {a['intervals']}")
