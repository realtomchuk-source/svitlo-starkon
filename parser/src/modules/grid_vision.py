import logging
from PIL import Image, ImageStat
import io

logger = logging.getLogger("SSSK-GridVision")

def is_outage_color(rgb):
    r, g, b = rgb
    # Orange Outage (old-style images with colored blocks)
    if r > 160 and r > b * 1.5 and r > g * 1.05: return True
    # Blue Outage (new-style images with blue/steel cells)
    if b > r + 15 and b > 150 and r < 200 and (r+g+b) < 700 and (r+g+b) > 350: return True
    return False

def is_edge_pixel(img, x, y, w, h):
    """Detect local intensity changes (edges) regardless of color."""
    if x <= 0 or x >= w - 1 or y <= 0 or y >= h - 1:
        return False
    
    # Simple horizontal gradient
    p1 = sum(img.getpixel((x-1, y)))
    p2 = sum(img.getpixel((x+1, y)))
    if abs(p1 - p2) > 60:
        return True
    
    p3 = sum(img.getpixel((x, y-1)))
    p4 = sum(img.getpixel((x, y+1)))
    if abs(p3 - p4) > 60:
        return True
        
    return False

def find_vertical_lines(img, w, h, detector_func, threshold_ratio=0.5, sample_step=10):
    v_votes = [0] * w
    num_samples = 0
    for y in range(h // 4, 3 * h // 4, sample_step):
        num_samples += 1
        for x in range(w):
            if detector_func(img.getpixel((x, y))):
                v_votes[x] += 1
    threshold = num_samples * threshold_ratio
    v_lines = []
    in_line = False
    for x in range(w):
        if v_votes[x] > threshold:
            if not in_line:
                v_lines.append(x)
                in_line = True
        else:
            in_line = False
    return v_lines

def find_horizontal_lines(img, h, x_start, x_end, detector_func, threshold_ratio=0.4, sample_step=20):
    h_votes = [0] * h
    num_samples = 0
    for x in range(x_start, x_end, sample_step):
        num_samples += 1
        for y in range(h):
            if detector_func(img.getpixel((x, y))):
                h_votes[y] += 1
    threshold = num_samples * threshold_ratio
    h_lines = []
    in_line = False
    for y in range(h):
        if h_votes[y] > threshold:
            if not in_line:
                h_lines.append(y)
                in_line = True
        else:
            in_line = False
    return h_lines

def find_best_block(lines, expected_count):
    if len(lines) < expected_count:
        return None
    best_block = []
    min_variance = float('inf')
    for i in range(len(lines) - expected_count + 1):
        block = lines[i:i + expected_count]
        spacings = [block[j+1] - block[j] for j in range(expected_count - 1)]
        avg = sum(spacings) / len(spacings)
        if avg < 5: continue
        variance = sum((s - avg)**2 for s in spacings) / len(spacings)
        if variance < min_variance:
            min_variance = variance
            best_block = block
    return best_block if best_block else None

def is_dark_pixel(rgb, threshold=650):
    return sum(rgb) < threshold

def is_grey_line_pixel(rgb):
    r, g, b = rgb
    s = r + g + b
    return 300 < s < 700 and abs(r - g) < 25 and abs(g - b) < 25

def parse_grid_from_image(img_bytes):
    try:
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        w, h = img.size
        logger.info(f"Image size: {w}x{h}")

        # ===== STRATEGY 1: Dark lines (for high-contrast) =====
        v_lines = find_vertical_lines(img, w, h, is_dark_pixel, threshold_ratio=0.5)
        if len(v_lines) >= 25:
            res = _solve_grid(img, w, h, v_lines, is_dark_pixel, "dark_lines")
            if res: return res

        # ===== STRATEGY 2: Grey lines (for light-themed) =====
        v_lines_grey = find_vertical_lines(img, w, h, is_grey_line_pixel, threshold_ratio=0.4, sample_step=2)
        if len(v_lines_grey) >= 25:
            res = _solve_grid(img, w, h, v_lines_grey, is_grey_line_pixel, "grey_lines")
            if res: return res

        # ===== STRATEGY 4: Interpolation (for obscured lines) =====
        def nonwhite_detector(rgb):
            return sum(rgb) < 750
            
        v_lines_nw = find_vertical_lines(img, w, h, nonwhite_detector, threshold_ratio=0.6, sample_step=2)
        interpolated = _interpolate_grid_lines(v_lines_nw, 25, w)
        if interpolated:
            res = _solve_grid(img, w, h, interpolated, nonwhite_detector, "interpolated")
            if res: return res

        # ===== STRATEGY 5: Edge/Transition detection (for B&W and low-contrast) =====
        logger.info("Strategies 1-4 failed. Trying Strategy 5 (Edge/Transitions)...")
        # Build an edge map proxy
        v_votes = [0] * w
        sample_rows = list(range(h // 4, 3 * h // 4, 5))
        for y in sample_rows:
            for x in range(1, w - 1):
                p1 = sum(img.getpixel((x-1, y)))
                p2 = sum(img.getpixel((x+1, y)))
                if abs(p1 - p2) > 30: # More sensitive edge (30 instead of 40)
                    v_votes[x] += 1
        
        threshold = len(sample_rows) * 0.25 # Lower threshold (0.25 instead of 0.3)
        v_lines_edge = []
        in_line = False
        for x in range(w):
            if v_votes[x] > threshold:
                if not in_line:
                    v_lines_edge.append(x)
                    in_line = True
            else:
                in_line = False
        
        if len(v_lines_edge) >= 15: # More lenient counts (15 instead of 20)
            logger.info(f"Strategy 5: found {len(v_lines_edge)} potential edge lines")
            interp_edge = _interpolate_grid_lines(v_lines_edge, 25, w)
            if interp_edge:
                # Use a specific detector for S5 that looks for dark OR edges
                def edge_or_dark(rgb):
                    return is_dark_pixel(rgb, threshold=700) # Local context is better
                
                res = _solve_grid(img, w, h, interp_edge, edge_or_dark, "edge_detect")
                if res: return res

        logger.error(f"All strategies failed. S1={len(v_lines)}, S2={len(v_lines_grey)}, S4_raw={len(v_lines_nw)}, S5_raw={len(v_lines_edge)}")
        return None

    except Exception as e:
        logger.error(f"Grid Vision error: {e}")
        return None


def _interpolate_grid_lines(detected_lines, target_count, img_width):
    """
    Given a set of detected lines (some missing due to cell colors),
    determine the regular step size and reconstruct the full grid.
    """
    if len(detected_lines) < 5:
        return None

    # Calculate all spacings between adjacent detected lines
    spacings = [detected_lines[i+1] - detected_lines[i] for i in range(len(detected_lines) - 1)]

    # Find single-cell spacings (the base unit)
    small_spacings = sorted([s for s in spacings if s < img_width // 15 and s > 10])
    if not small_spacings:
        return None

    base_step = small_spacings[len(small_spacings) // 2]

    # Refine base_step
    unit_spacings = []
    for s in spacings:
        ratio = s / base_step
        rounded = round(ratio)
        if rounded >= 1 and abs(ratio - rounded) < 0.4:
            unit = s / rounded
            for _ in range(rounded):
                unit_spacings.append(unit)

    if unit_spacings:
        unit_spacings.sort()
        base_step = unit_spacings[len(unit_spacings) // 2]
    
    logger.info(f"  Interpolation: step={base_step:.2f}px")

    best_grid = None
    best_score = 0
    tolerance = max(4, base_step * 0.15)

    for anchor_x in detected_lines:
        for col_offset in range(target_count):
            start_x = anchor_x - col_offset * base_step
            candidate_grid = [round(start_x + i * base_step) for i in range(target_count)]

            if candidate_grid[0] < -tolerance or candidate_grid[-1] >= img_width + tolerance:
                continue

            score = 0
            for cx in candidate_grid:
                if any(abs(cx - dx) <= tolerance for dx in detected_lines):
                    score += 1

            if score > best_score:
                best_score = score
                best_grid = candidate_grid

    if best_grid and best_score >= target_count * 0.35: 
        logger.info(f"  Interpolation: score={best_score}/{target_count}")
        return best_grid

    return None


def _solve_grid(img, w, h, v_lines, detector_func, strategy_name):
    """Given detected vertical lines, find horizontal lines and extract the grid."""
    target_v = find_best_block(v_lines, 25)
    if not target_v:
        return None

    # Use a more sensitive horizontal search for low-contrast images
    h_lines = find_horizontal_lines(img, h, target_v[0], target_v[-1], detector_func, threshold_ratio=0.2, sample_step=8)

    if len(h_lines) < 13:
        # Fallback to absolute darkness if needed
        def dark_fallback(rgb):
            return sum(rgb) < 700
        h_lines = find_horizontal_lines(img, h, target_v[0], target_v[-1], dark_fallback, threshold_ratio=0.15, sample_step=5)

    target_h = find_best_block(h_lines, 13)
    if not target_h:
        # One last try: vertical gradient instead of pixel brightness
        h_votes = [0] * h
        for x in range(target_v[0], target_v[-1], 10):
            for y in range(1, h - 1):
                p1 = sum(img.getpixel((x, y-1)))
                p2 = sum(img.getpixel((x, y+1)))
                if abs(p1 - p2) > 30:
                    h_votes[y] += 1
        h_lines_edge = []
        for y in range(h):
            if h_votes[y] > ( (target_v[-1]-target_v[0])//10 * 0.2 ):
                if not h_lines_edge or y - h_lines_edge[-1] > 5:
                    h_lines_edge.append(y)
        target_h = find_best_block(h_lines_edge, 13)

    if not target_h:
        logger.error(f"[{strategy_name}] Could not find 13 horizontal lines")
        return None

    logger.info(f"[{strategy_name}] Grid Solved: {len(target_v)}V, {len(target_h)}H")

    queues = {}
    group_names = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"]

    for row in range(12):
        y1, y2 = target_h[row], target_h[row + 1]
        cy = (y1 + y2) // 2
        hours_bits = []
        for col in range(24):
            x1, x2 = target_v[col], target_v[col + 1]
            cx = (x1 + x2) // 2

            sample_size = max(2, min(6, (x2 - x1) // 6))
            outage_votes = 0
            total_votes = 0
            for dx in range(-sample_size, sample_size + 1, 2):
                for dy in range(-sample_size, sample_size + 1, 2):
                    px, py = cx + dx, cy + dy
                    if 0 <= px < w and 0 <= py < h:
                        total_votes += 1
                        if is_outage_color(img.getpixel((px, py))):
                            outage_votes += 1

            is_outage = total_votes > 0 and (outage_votes / total_votes) > 0.25
            hours_bits.append("0" if is_outage else "1")
        queues[group_names[row]] = "".join(hours_bits)

    return queues

