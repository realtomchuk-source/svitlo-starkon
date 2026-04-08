import json
import os

def analyze_archive(path):
    if not os.path.exists(path):
        return {"error": f"File not found at {path}"}
    
    with open(path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            return {"error": f"Failed to parse JSON: {e}"}
            
    stats = {
        "total": len(data),
        "success": 0,
        "failed": 0,
        "types": {},
        "dates": []
    }
    
    for entry in data:
        stats["dates"].append(entry.get("date", "unknown"))
        if entry.get("processed"):
            stats["success"] += 1
        else:
            stats["failed"] += 1
            
        t = entry.get("type", "unknown")
        stats["types"][t] = stats["types"].get(t, 0) + 1
        
    stats["dates"].sort()
    if stats["dates"]:
        stats["min_date"] = stats["dates"][0]
        stats["max_date"] = stats["dates"][-1]
        
    return stats

if __name__ == "__main__":
    archive_path = r"c:\Users\АТом\Desktop\Antigravity\SSSK\parser\data\unified_schedules.json"
    results = analyze_archive(archive_path)
    print(json.dumps(results, indent=2))
