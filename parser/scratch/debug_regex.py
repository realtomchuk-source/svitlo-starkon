import re

segment = "черга 4.1: 07:00-11:00 - буде відключено згідно з графіком."

# Test Queue Regex
q_pattern = r"(?:черг[аі]|підчерг[аі])?\s*([1-6][\.,][12])"
q_matches = re.findall(q_pattern, segment)
print(f"Queues found: {q_matches}")

# Test Time Regex
t_pattern = r'(\d{1,2})[:.]?00?\s*-\s*(\d{1,2})[:.]?00?'
t_matches = re.findall(t_pattern, segment)
print(f"Times found: {t_matches}")

# Test Keyword
action = "OFF" if any(kw in segment for kw in ["відключено", "знеструмлено"]) else "NONE"
print(f"Action: {action}")
