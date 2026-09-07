# -*- coding: utf-8 -*-
import csv
import json
import os
import sys

# Fix Windows console encoding to support UTF-8 output
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Define file paths relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'import_data.csv')
JSON_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'student_statistics.json')

def main():
    print("==================================================")
    print("TIEN ICH TU DONG HOA NHAP LIEU - EDUMETRICS")
    print("==================================================")

    if not os.path.exists(CSV_PATH):
        print(f"Loi: Khong tim thay file nhap lieu '{CSV_PATH}'")
        print("Vui long tao file nay theo mau truoc khi chay.")
        sys.exit(1)

    print(f"-> Dang doc du lieu tu file: {CSV_PATH}...")

    departments = []
    total_reg = 0
    total_active = 0
    total_dropped = 0

    try:
        # Use utf-8-sig to automatically handle Excel BOM if present
        with open(CSV_PATH, mode='r', encoding='utf-8-sig') as f:
            # Auto-detect separator (comma or semicolon)
            sample = f.read(2048)
            f.seek(0)
            delimiter = ','
            if ';' in sample and sample.count(';') > sample.count(','):
                delimiter = ';'
            
            reader = csv.reader(f, delimiter=delimiter)
            
            # Read header
            header = next(reader)
            
            # Process rows
            row_idx = 1
            for row in reader:
                row_idx += 1
                if not row or len(row) < 3:
                    continue  # Skip empty or incomplete rows
                
                dept_name = row[0].strip()
                if not dept_name:
                    continue
                
                try:
                    # Clean commas or dots if user inputted formatted numbers in CSV
                    reg_str = row[1].replace(',', '').replace('.', '').strip()
                    active_str = row[2].replace(',', '').replace('.', '').strip()
                    
                    registered = int(reg_str)
                    active = int(active_str)
                except ValueError:
                    print(f"Canh bao: Bo qua dong {row_idx} do loi dinh dang so: {row}")
                    continue

                # Auto-calculation of dropped students
                dropped = registered - active
                if dropped < 0:
                    print(f"Canh bao o dong {row_idx} ({dept_name}): So sinh vien con hoc ({active}) lon hon so dang ky ({registered})!")
                    # Adjust dropped to 0 or leave negative? Let's cap dropped at 0 for visual safety
                    dropped = 0
                    active = registered
                
                departments.append({
                    "name": dept_name,
                    "registered": registered,
                    "active": active,
                    "dropped": dropped
                })

                # Accumulate totals
                total_reg += registered
                total_active += active
                total_dropped += dropped

    except Exception as e:
        print(f"Loi khi doc file CSV: {str(e)}")
        sys.exit(1)

    if not departments:
        print("Loi: Khong co du lieu hop le nao duoc doc tu file CSV!")
        sys.exit(1)

    # Compute overall active percentage
    pct_active = (total_active / total_reg * 100) if total_reg > 0 else 0

    # Build JSON structure
    output_data = {
        "summary": {
            "title": "Sinh viên còn học",
            "registered": total_reg,
            "active": total_active,
            "dropped": total_dropped
        },
        "departments": departments
    }

    # Write to student_statistics.json
    try:
        with open(JSON_PATH, mode='w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print("\n-> Da Tinh Toan va Chuyen Doi Du Lieu Thanh Cong:")
        print(f"   * Tong dang ky: {total_reg:,} sinh vien")
        print(f"   * Tong con hoc: {total_active:,} sinh vien")
        print(f"   * Tong thoi hoc: {total_dropped:,} sinh vien")
        print(f"   * Ti le con hoc: {pct_active:.2f}%")
        print(f"\n[OK] Da cap nhat file '{JSON_PATH}'!")
        print("Dashboard cua ban se tu dong tai lai so lieu moi nay sau 5 giay.")
        print("==================================================")
        
    except Exception as e:
        print(f"Loi khi ghi file JSON: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()
