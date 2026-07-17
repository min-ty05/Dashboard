# -*- coding: utf-8 -*-
import http.server
import json
import os
import sys
import csv
 
PORT = 8000
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
 
# Ensure standard output uses UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
 
class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
 
    # ── Dataset registry (mirrors DATASETS in app.js) ───────────────────────
    # To add a new sheet later: add one entry here (and the matching one in
    # app.js) — the save route below reads from this table generically.
    DATASET_CONFIG = {
        "khoa": {
            "csv_file": "import_data.csv",
            "json_file": "student_statistics.json",
            "csv_header": ["Khoa", "Đăng ký đầu kỳ", "Còn học"],
            "field_b": "registered",
            "field_c": "active",
            "mode": "ratio",
            "summary_title": "Sinh viên còn học",
        },
        "nhansu": {
            "csv_file": "staff_data.csv",
            "json_file": "staff_statistics.json",
            "csv_header": ["Bộ phận", "Nam", "Nữ"],
            "field_b": "male",
            "field_c": "female",
            "mode": "sum",
            "summary_title": "Nhân sự theo khoa",
        },
    }
 
    def do_POST(self):
        if self.path == "/api/save_data":
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
 
                dataset_key = data.get("dataset", "khoa")
                cfg = self.DATASET_CONFIG.get(dataset_key)
                if not cfg:
                    raise ValueError(f"Bảng dữ liệu không hợp lệ: {dataset_key}")
 
                csv_path = os.path.join(DIRECTORY, "data", cfg["csv_file"])
                json_path = os.path.join(DIRECTORY, "data", cfg["json_file"])
                field_b, field_c = cfg["field_b"], cfg["field_c"]
 
                os.makedirs(os.path.dirname(csv_path), exist_ok=True)
 
                # Write CSV
                with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(cfg["csv_header"])
                    for row in data["departments"]:
                        writer.writerow([row["name"], row["registered"], row["active"]])
 
                # Re-calculate and write JSON
                total_b = 0
                total_c = 0
                total_d = 0
                depts = []
 
                for row in data["departments"]:
                    name = row["name"].strip()
                    if not name:
                        continue
                    try:
                        b_val = int(str(row["registered"]).replace(',', '').replace('.', '').strip())
                        c_val = int(str(row["active"]).replace(',', '').replace('.', '').strip())
                    except ValueError:
                        b_val = 0
                        c_val = 0
 
                    if cfg["mode"] == "ratio":
                        d_val = b_val - c_val
                        if d_val < 0:
                            d_val = 0
                            c_val = b_val
                    else:
                        d_val = b_val + c_val
 
                    depts.append({
                        "name": name,
                        field_b: b_val,
                        field_c: c_val,
                    })
 
                    total_b += b_val
                    total_c += c_val
                    total_d += d_val
 
                summary = {"title": cfg["summary_title"], field_b: total_b, field_c: total_c}
                if cfg["mode"] == "ratio":
                    summary["dropped"] = total_d
                    depts_with_extra = []
                    for i, d in enumerate(depts):
                        d["dropped"] = max(0, d[field_b] - d[field_c])
                        depts_with_extra.append(d)
                    depts = depts_with_extra
                else:
                    summary["total"] = total_d
 
                output_data = {"summary": summary, "departments": depts}
 
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(output_data, f, ensure_ascii=False, indent=2)
 
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode('utf-8'))
                print(f"[API] Saved '{dataset_key}' data successfully to CSV and JSON.")
 
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode('utf-8'))
                print(f"[API ERROR] Failed to save data: {str(e)}")
        else:
            # Fallback to default handler for other POST requests
            super().do_POST()
 
if __name__ == "__main__":
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, DashboardHandler)
    print(f"Starting EduMetrics Web Server on port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        sys.exit(0)
 