import logging
from PIL import Image, ImageStat
import io
import os

logger = logging.getLogger("SSSK-GridVision")

def _linspace(start, stop, num):
    """Native replacement for np.linspace to avoid numpy dependency."""
    if num <= 0: return []
    if num == 1: return [float(start)]
    step = (stop - start) / (num - 1)
    return [float(start + i * step) for i in range(num)]

def is_outage_color(rgb):
    r, g, b = rgb
    # Blue Outage (standard)
    if b > r + 15 and b > 130 and r < 215 and (r+g+b) < 720 and b > g + 10: return True
    # Darker blue/grey outage
    if b > 120 and abs(r-g) < 25 and b > r + 8 and (r+g+b) < 620: return True
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
        # For rows (13 lines), height should be at least 15px. For columns (25 lines), width at least 15px.
        min_acc_spacing = 15 if expected_count == 13 else 25 
        if avg < min_acc_spacing: continue
        
        # Check for outliers in spacing (should be regular)
        max_s = max(spacings)
        min_s = min(spacings)
        if max_s > min_s * 2.5: continue # Too much variation
        
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

        # ===== STRATEGY 3: Gradient Edges (BEST for colorful images) =====
        def edge_detector(rgb_at_pos):
             # Since detector_func only gets RGB, we use a simple dark/light contrast
             return sum(rgb_at_pos) < 600
        
        v_votes = [0] * w
        for y in range(h // 4, 3 * h // 4, 10):
            for x in range(1, w - 1):
                p_left = sum(img.getpixel((x-1, y)))
                p_right = sum(img.getpixel((x+1, y)))
                if abs(p_left - p_right) > 40: # Edge detection
                    v_votes[x] += 1
        
        v_lines_grad = [x for x in range(w) if v_votes[x] > ( (h//2)//10 * 0.3 )]
        if len(v_lines_grad) >= 20:
             interp = _interpolate_grid_lines(v_lines_grad, 25, w)
             if interp:
                 res = _solve_grid(img, w, h, interp, is_dark_pixel, "gradient_detect")
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


def save_debug_image(img, v_lines, h_lines, filename="debug_grid.png"):
    """Saves an annotated image with detected grid lines for debugging."""
    try:
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        w, h = img.size
        # Draw vertical lines (blue)
        for x in v_lines:
            draw.line([(x, 0), (x, h)], fill=(0, 0, 255), width=2)
        # Draw horizontal lines (red)
        for y in h_lines:
            draw.line([(0, y), (w, y)], fill=(255, 0, 0), width=2)
        
        # Draw sampling dots for the first cell as example
        if len(v_lines) >= 2 and len(h_lines) >= 2:
            x1, x2 = v_lines[0], v_lines[1]
            y1, y2 = h_lines[0], h_lines[1]
            cx, cy = (x1+x2)//2, (y1+y2)//2
            draw.ellipse([cx-3, cy-3, cx+3, cy+3], fill=(0, 255, 0))

        # debug_path = r"C:\Users\АТом\Desktop\Antigravity\SSSK\parser\data\\" + filename
        debug_path = os.path.join("parser", "data", filename)
        os.makedirs(os.path.dirname(debug_path), exist_ok=True)
        img.save(debug_path)
        logger.info(f"Debug grid saved to {debug_path}")
    except Exception as e:
        logger.warning(f"Failed to save debug image: {e}")


def _interpolate_grid_lines(detected_lines, target_count, total_size):
    """
    Generic interpolation for grid lines (horizontal or vertical).
    """
    if len(detected_lines) < 5:
        return None

    # Calculate all spacings between adjacent detected lines
    spacings = [detected_lines[i+1] - detected_lines[i] for i in range(len(detected_lines) - 1)]

    # Find base unit spacings
    # Rows: ~1/12th of grid height. Columns: ~1/24th of grid width.
    # We look for spacings that are roughly consistent.
    small_spacings = sorted([s for s in spacings if s > 10])
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
        for offset in range(target_count):
            start_pos = anchor_x - offset * base_step
            candidate_grid = [round(start_pos + i * base_step) for i in range(target_count)]

            if candidate_grid[0] < -tolerance or candidate_grid[-1] >= total_size + tolerance:
                continue

            score = 0
            for pos in candidate_grid:
                if any(abs(pos - detected_pos) <= tolerance for detected_pos in detected_lines):
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
        # Try interpolation for vertical too
        target_v = _interpolate_grid_lines(v_lines, 25, w)
        if not target_v: return None

    # Determine Y-range of the grid by scanning multiple vertical lines for consensus
    y_votes_start = {}
    y_votes_end = {}
    
    # Check 5 vertical lines spread across the grid
    sample_v_indices = [int(i) for i in _linspace(0, len(target_v)-1, 5)]
    for idx in sample_v_indices:
        test_x = target_v[idx]
        # Start from top
        for y in range(h):
            if detector_func(img.getpixel((test_x, y))):
                y_votes_start[y] = y_votes_start.get(y, 0) + 1
                break
        # Start from bottom
        for y in range(h-1, -1, -1):
            if detector_func(img.getpixel((test_x, y))):
                y_votes_end[y] = y_votes_end.get(y, 0) + 1
                break
    
    if y_votes_start:
        # We want the most frequent "top" area that is fairly low (not the title)
        # Usually the grid top is below Y=100
        possible_tops = sorted(y_votes_start.keys())
        y_min = possible_tops[len(possible_tops)//2] # Median
    else:
        y_min = 0
        
    if y_votes_end:
        possible_ends = sorted(y_votes_end.keys())
        y_max = possible_ends[len(possible_ends)//2] # Median
    else:
        y_max = h - 1
            
    # CRITICAL: Table header usually starts after some vertical line activity.
    # The actual grid rows start below the header (which is roughly 25% of grid height)
    # But since we want all 13 lines (including header top), we stay at y_min.
    
    logger.info(f"[{strategy_name}] Restricted Y-range: {y_min}-{y_max}")

    # Horizontal detection restricted to detected Y-range
    # We use a more sensitive threshold for horizontal lines
    h_lines_raw = find_horizontal_lines(img, h, target_v[0], target_v[-1], detector_func, threshold_ratio=0.3, sample_step=4)
    h_lines = [y for y in h_lines_raw if y_min <= y <= y_max]

    if len(h_lines) < 13:
        # Fallback to absolute darkness or edge detection
        def dark_fallback(rgb): return sum(rgb) < 710
        h_lines_alt = find_horizontal_lines(img, h, target_v[0], target_v[-1], dark_fallback, threshold_ratio=0.12, sample_step=4)
        if len(h_lines_alt) > len(h_lines): h_lines = h_lines_alt

    target_h = find_best_block(h_lines, 13)
    if not target_h:
        # Final attempt: Interpolate missing horizontal lines
        logger.info(f"[{strategy_name}] Horizontal lines missing. Reconstructing from {len(h_lines)} detections...")
        target_h = _interpolate_grid_lines(h_lines, 13, h)

    # --- STRICT 13 LINES LOGIC ---
    # We MUST have exactly 13 horizontal lines (for 12 rows: 1.1 to 6.2).
    # Even if lines are missing, we interpolate or split based on row heights.

    if not target_h:
        # Fallback to absolute interpolation of the whole height
        logger.warning(f"[{strategy_name}] No horizontal lines found. Absolute interpolation fallback.")
        target_h = [int(y) for y in _linspace(0, h-1, 13)]
    
    # split intervals until we have 12
    h_lines = sorted(list(set(target_h)))
    for _ in range(20):
        if len(h_lines) >= 13: break
        
        # Find interval with maximum height
        max_idx = -1
        max_dist = -1
        for i in range(len(h_lines) - 1):
            dist = h_lines[i+1] - h_lines[i]
            if dist > max_dist:
                max_dist = dist
                max_idx = i
        
        if max_idx != -1:
            y_start, y_end = h_lines[max_idx], h_lines[max_idx+1]
            mid_math = y_start + max_dist // 2
            
            # --- REFINED SPLIT ---
            # Search for a better split point (actual line) within +/- 6px of middle
            best_mid = mid_math
            best_edge_score = -1
            
            # Scan a vertical strip in the middle of current block columns
            test_x = (target_v[0] + target_v[-1]) // 2
            for dy in range(-6, 7):
                ty = mid_math + dy
                if 0 <= ty < h:
                    # Score by darkness and contrast
                    p_curr = sum(img.getpixel((test_x, ty)))
                    p_prev = sum(img.getpixel((test_x, ty-1))) if ty > 0 else p_curr
                    contrast = abs(p_curr - p_prev)
                    # We prefer dark pixels with local contrast (lines)
                    score = contrast + (765 - p_curr) // 4
                    if score > best_edge_score:
                        best_edge_score = score
                        best_mid = ty
            
            h_lines.insert(max_idx + 1, best_mid)
            
    if len(h_lines) > 13:
        # If we have too many, try to find the 13 most regular ones 
        # (usually this means the first detected block was too big)
        h_lines = h_lines[:13]
    
    target_h = h_lines

    logger.info(f"[{strategy_name}] Grid Solved: {len(target_v)}V, {len(target_h)}H")
    
    # Save debug image
    save_debug_image(img.copy(), target_v, target_h)

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

