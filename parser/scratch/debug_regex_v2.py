import re

block = "черга 4.1: 07:00-11:00 - буде відключено згідно з графіком. черга 1.1 - заживлено!"

# NEW split logic
segments = re.split(r'\.(?!\d)|;|!|\n', block)
print(f"Segments: {segments}")

for segment in segments:
    segment = segment.strip().lower()
    if not segment: continue
    
    # Queue search
    q_pattern = r"(?:черг[аі]|підчерг[аі])?\s*([1-6][\.,][12])"
    qs = re.findall(q_pattern, segment)
    
    # Time search
    t_pattern = r'(\d{1,2})(?:[:.]00)?\s*[–—-]\s*(\d{1,2})(?:[:.]00)?'
    ts = re.findall(t_pattern, segment)
    
    print(f"Segment: '{segment}' | Queues: {qs} | Times: {ts}")
