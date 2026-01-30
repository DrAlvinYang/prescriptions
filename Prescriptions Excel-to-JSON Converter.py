#!/opt/homebrew/bin/python3
import pandas as pd
import json
import os
import sys

# Configuration
# Using absolute paths to ensure execution from any location
EXCEL_FILE = "/Users/alvin/Documents/Documents - Alvin's Macbook/Alvin/Medicine/Work/ED Website/Prescriptions/Prescriptions.xlsx"
OUTPUT_FILE = "/Users/alvin/Documents/Documents - Alvin's Macbook/Alvin/Medicine/Work/ED Website/Prescriptions/Prescriptions.json"

def clean_text(val):
    """Helper to handle empty/NaN cells gracefully."""
    if pd.isna(val) or val == "":
        return ""
    return str(val).strip()

def clean_refill(val):
    """
    Helper to normalize refill amount to a whole number string.
    e.g. 1.0 -> "1", 0.0 -> "0", "1" -> "1"
    """
    if pd.isna(val) or val == "":
        return ""
    try:
        # Convert to float first to handle strings like "1.0" or floats like 1.0
        f_val = float(val)
        # Convert to int to remove decimal, then to string
        return str(int(f_val))
    except (ValueError, TypeError):
        # If conversion fails (e.g. text), return as cleaned string
        return str(val).strip()

def convert_excel_to_json():
    print("=" * 70)
    print("PRESCRIPTION EXCEL TO JSON CONVERTER")
    print("=" * 70)
    print(f"\nReading {EXCEL_FILE}...")
    
    try:
        # Load the Excel file (all sheets)
        xls = pd.ExcelFile(EXCEL_FILE)
    except FileNotFoundError:
        print(f"\n✗ ERROR: Could not find '{EXCEL_FILE}'")
        print("Please check that the file path is correct.")
        input("\nPress Enter to close...")
        return
    except Exception as e:
        print(f"\n✗ ERROR reading Excel file: {e}")
        input("\nPress Enter to close...")
        return

    print(f"\n✓ Found {len(xls.sheet_names)} sheets:")
    for sheet in xls.sheet_names:
        print(f"  - {sheet}")
    print()

    meds = []

    for sheet_name in xls.sheet_names:
        print(f"Processing sheet: {sheet_name}")
        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # Standardize headers to match our logic (strip spaces)
        df.columns = [c.strip() for c in df.columns]
        
        row_count = 0
        for index, row in df.iterrows():
            # 1. Skip rows where 'Med' is empty
            if pd.isna(row.get('Med')) or str(row.get('Med')).strip() == "":
                continue

            # 2. Parse Brands (Aliases)
            # Expecting comma-separated string: "Advil, Motrin"
            raw_alias = row.get('Alias', '')
            if pd.notna(raw_alias) and str(raw_alias).strip() != "":
                brands = [b.strip() for b in str(raw_alias).split(',') if b.strip()]
            else:
                brands = []

            # 3. Parse Numbers (handle empty cells)
            dose_per_kg = row.get('DosePerKg')
            if pd.isna(dose_per_kg) or dose_per_kg == "":
                dose_per_kg = None
            else:
                try:
                    dose_per_kg = float(dose_per_kg)
                except (ValueError, TypeError):
                    dose_per_kg = None

            max_dose = row.get('MaxDose')
            if pd.isna(max_dose) or max_dose == "":
                max_dose = None
            else:
                try:
                    max_dose = float(max_dose)
                except (ValueError, TypeError):
                    max_dose = None

            # 4. Determine Weight Based Logic
            # A medication is weight-based if it has a valid dose_per_kg value
            # This is more reliable than relying on a separate boolean column
            weight_based = dose_per_kg is not None and dose_per_kg > 0

            # 5. Extract Indication
            indication = clean_text(row.get('Indication'))

            # 6. Build Search Text
            # Combine relevant fields so search finds everything
            search_components = [
                sheet_name,                     # Specialty (from Sheet Name)
                clean_text(row.get('Population')),
                clean_text(row.get('Subcategory')),
                indication,                     # Added Indication to search logic
                clean_text(row.get('Med')),
                " ".join(brands),               # Add brands as keywords
                clean_text(row.get('Dose')),
                clean_text(row.get('PRN')),
                clean_text(row.get('Comments'))
            ]
            search_text = " | ".join([c for c in search_components if c])

            # 7. Construct the Object
            med_obj = {
                "specialty": sheet_name,
                "med": clean_text(row.get('Med')),
                "brands": brands,
                "indication": indication,   # New Field
                "dose_text": clean_text(row.get('Dose')),
                "route": clean_text(row.get('Route')),
                "frequency": clean_text(row.get('Frequency')),
                "duration": clean_text(row.get('Duration')),
                "dispense": clean_text(row.get('Dispense')),
                "refill": clean_refill(row.get('Refill')),
                "prn": clean_text(row.get('PRN')),
                "form": clean_text(row.get('Form')),
                "comments": clean_text(row.get('Comments')),
                "population": clean_text(row.get('Population')),
                "subcategory": clean_text(row.get('Subcategory')),
                "weight_based": weight_based,
                "dose_per_kg_mg": dose_per_kg,
                "max_dose_mg": max_dose,
                "search_text": search_text.lower()
            }
            meds.append(med_obj)
            row_count += 1
        
        print(f"  → Added {row_count} medications from {sheet_name}")

    # 8. Write to JSON
    final_output = {
        "source": {
            "file": os.path.basename(EXCEL_FILE),
            "record_count": len(meds)
        },
        "meds": meds
    }

    # 'w' mode automatically overwrites existing files
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, indent=2)
        
        print("\n" + "=" * 70)
        print("✓ SUCCESS!")
        print("=" * 70)
        print(f"Converted {len(meds)} prescriptions to:")
        print(f"{OUTPUT_FILE}")
        
        print(f"\nVerifying output...")
        
        # Verify the file was created and is valid JSON
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            verify = json.load(f)
            print(f"✓ JSON file is valid")
            print(f"✓ Contains {verify['source']['record_count']} medications")
            
            # Show specialty breakdown
            specialty_counts = {}
            for med in verify['meds']:
                spec = med['specialty']
                specialty_counts[spec] = specialty_counts.get(spec, 0) + 1
            
            print(f"\nSpecialty breakdown:")
            for spec, count in sorted(specialty_counts.items()):
                print(f"  {spec}: {count} medications")
        
        print("\n" + "=" * 70)
        print("CONVERSION COMPLETE!")
        print("=" * 70)
                
    except Exception as e:
        print(f"\n✗ ERROR writing or verifying JSON file: {e}")
        input("\nPress Enter to close...")
        return

if __name__ == "__main__":
    try:
        convert_excel_to_json()
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n")
        input("Press Enter to close this window...")