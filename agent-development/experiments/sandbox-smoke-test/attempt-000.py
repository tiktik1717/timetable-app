import json, os, glob

# 1. Locate metadata.json
paths = glob.glob("/mnt/data/*metadata.json")
if not paths:
    raise FileNotFoundError("metadata.json not found in /mnt/data")
meta_path = paths[0]

# 2. Parse JSON
with open(meta_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# 3. Count entities
sd = data["schoolData"]
result = {
    "teacherCount": len(sd.get("teachers", [])),
    "classCount": len(sd.get("classes", [])),
    "teachingUnitCount": len(sd.get("teachingUnits", [])),
}

# 4. Write result.json
out_path = "/mnt/data/result.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(result, f, separators=(",", ":"))

# 5. Read back and print log line
with open(out_path, "r", encoding="utf-8") as f:
    reread = json.load(f)

print("SANDBOX_RESULT=" + json.dumps(reread, separators=(",", ":")))
reread