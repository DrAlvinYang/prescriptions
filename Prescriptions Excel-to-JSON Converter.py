#!/opt/homebrew/bin/python3
"""
Prescription Excel-to-JSON Converter

Converts a multi-sheet Excel workbook of medical prescriptions into a structured
JSON file for use by the ED Prescriptions web application.

Usage:
    python "Prescriptions Excel-to-JSON Converter.py"
    python "Prescriptions Excel-to-JSON Converter.py" --non-interactive
    python "Prescriptions Excel-to-JSON Converter.py" --input custom.xlsx --output custom.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Optional

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Required columns that must exist in each sheet
REQUIRED_COLUMNS: frozenset[str] = frozenset({"Med"})

# Optional columns with their default values if missing
OPTIONAL_COLUMNS: dict[str, Any] = {
    "Alias": "",
    "Indication": "",
    "Dose": "",
    "Route": "",
    "Frequency": "",
    "Duration": "",
    "Dispense": "",
    "Refill": "",
    "PRN": "",
    "Form": "",
    "Comments": "",
    "Population": "",
    "Subcategory": "",
    "DosePerKg": None,
    "MaxDose": None,
}

# Default file paths (relative to script location)
DEFAULT_EXCEL_FILENAME: str = "Prescriptions.xlsx"
DEFAULT_OUTPUT_FILENAME: str = "Prescriptions.json"

# ---------------------------------------------------------------------------
# Logging Setup
# ---------------------------------------------------------------------------

logger = logging.getLogger(__name__)


def setup_logging(verbose: bool = False) -> None:
    """Configure logging with appropriate level and format."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(levelname)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def clean_text(val: Any) -> str:
    """
    Convert a cell value to a cleaned string.

    Handles empty/NaN cells gracefully by returning empty string.
    Strips leading/trailing whitespace from string values.

    Args:
        val: Any cell value from pandas DataFrame

    Returns:
        Cleaned string representation, or empty string if null/empty
    """
    if pd.isna(val) or val == "":
        return ""
    return str(val).strip()


def clean_refill(val: Any) -> str:
    """
    Normalize refill amount to a whole number string.

    Handles various input formats:
        - 1.0 -> "1"
        - 0.0 -> "0"
        - "1" -> "1"
        - "" -> ""
        - "PRN" -> "PRN" (text preserved)

    Args:
        val: Refill value from Excel cell

    Returns:
        Normalized string representation
    """
    if pd.isna(val) or val == "":
        return ""
    try:
        f_val = float(val)
        return str(int(f_val))
    except (ValueError, TypeError):
        return str(val).strip()


def parse_numeric(val: Any, field_name: str, row_context: str) -> Optional[float]:
    """
    Parse a numeric value with logging for failed conversions.

    Args:
        val: Value to parse
        field_name: Name of the field (for logging)
        row_context: Context string for logging (e.g., medication name)

    Returns:
        Parsed float value, or None if empty/invalid
    """
    if pd.isna(val) or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        logger.warning(
            "Could not parse %s value '%s' for %s - treating as None",
            field_name,
            val,
            row_context,
        )
        return None


def parse_brands(raw_alias: Any) -> list[str]:
    """
    Parse comma-separated brand names into a list.

    Args:
        raw_alias: Raw alias string from Excel (e.g., "Advil, Motrin")

    Returns:
        List of cleaned brand name strings
    """
    if pd.isna(raw_alias) or str(raw_alias).strip() == "":
        return []
    return [b.strip() for b in str(raw_alias).split(",") if b.strip()]


def build_search_text(components: list[str]) -> str:
    """
    Build searchable text from components.

    Joins non-empty components with pipe delimiter and lowercases.

    Args:
        components: List of text components to join

    Returns:
        Lowercase search string with components joined by ' | '
    """
    filtered = [c for c in components if c]
    return " | ".join(filtered).lower()


# ---------------------------------------------------------------------------
# Validation Functions
# ---------------------------------------------------------------------------


def validate_columns(df: pd.DataFrame, sheet_name: str) -> tuple[bool, list[str]]:
    """
    Validate that required columns exist in the DataFrame.

    Args:
        df: DataFrame to validate
        sheet_name: Name of the sheet (for error messages)

    Returns:
        Tuple of (is_valid, list of missing column names)
    """
    existing_columns = set(df.columns)
    missing = REQUIRED_COLUMNS - existing_columns
    return len(missing) == 0, list(missing)


def validate_medication(med_obj: dict[str, Any]) -> list[str]:
    """
    Validate a medication object has critical fields.

    Args:
        med_obj: Medication dictionary to validate

    Returns:
        List of warning messages (empty if valid)
    """
    warnings: list[str] = []
    med_name = med_obj.get("med", "Unknown")

    if not med_obj.get("med"):
        warnings.append(f"Empty medication name in {med_obj.get('specialty', 'Unknown')}")

    if not med_obj.get("dose_text") and not med_obj.get("weight_based"):
        warnings.append(f"No dose specified for non-weight-based medication: {med_name}")

    return warnings


# ---------------------------------------------------------------------------
# Core Conversion Logic
# ---------------------------------------------------------------------------


def process_row(row: dict[str, Any], sheet_name: str) -> Optional[dict[str, Any]]:
    """
    Process a single row from the Excel sheet into a medication object.

    Args:
        row: Dictionary representing one row (from df.to_dict('records'))
        sheet_name: Name of the sheet (used as specialty)

    Returns:
        Medication dictionary, or None if row should be skipped
    """
    # Skip rows where 'Med' is empty
    med_value = row.get("Med")
    if pd.isna(med_value) or str(med_value).strip() == "":
        return None

    med_name = clean_text(med_value)

    # Parse brands
    brands = parse_brands(row.get("Alias", ""))

    # Parse numeric fields
    dose_per_kg = parse_numeric(
        row.get("DosePerKg"), "DosePerKg", med_name
    )
    max_dose = parse_numeric(
        row.get("MaxDose"), "MaxDose", med_name
    )

    # Determine weight-based logic
    weight_based = dose_per_kg is not None and dose_per_kg > 0

    # Extract text fields
    indication = clean_text(row.get("Indication", ""))

    # Build search text
    search_components = [
        sheet_name,
        clean_text(row.get("Population", "")),
        clean_text(row.get("Subcategory", "")),
        indication,
        med_name,
        " ".join(brands),
        clean_text(row.get("Dose", "")),
        clean_text(row.get("PRN", "")),
        clean_text(row.get("Comments", "")),
    ]
    search_text = build_search_text(search_components)

    return {
        "specialty": sheet_name,
        "med": med_name,
        "brands": brands,
        "indication": indication,
        "dose_text": clean_text(row.get("Dose", "")),
        "route": clean_text(row.get("Route", "")),
        "frequency": clean_text(row.get("Frequency", "")),
        "duration": clean_text(row.get("Duration", "")),
        "dispense": clean_text(row.get("Dispense", "")),
        "refill": clean_refill(row.get("Refill", "")),
        "prn": clean_text(row.get("PRN", "")),
        "form": clean_text(row.get("Form", "")),
        "comments": clean_text(row.get("Comments", "")),
        "population": clean_text(row.get("Population", "")),
        "subcategory": clean_text(row.get("Subcategory", "")),
        "weight_based": weight_based,
        "dose_per_kg_mg": dose_per_kg,
        "max_dose_mg": max_dose,
        "search_text": search_text,
    }


def process_sheet(
    xls: pd.ExcelFile, sheet_name: str
) -> tuple[list[dict[str, Any]], int]:
    """
    Process a single Excel sheet into medication objects.

    Args:
        xls: Excel file object
        sheet_name: Name of the sheet to process

    Returns:
        Tuple of (list of medication dicts, count of validation warnings)
    """
    logger.info("Processing sheet: %s", sheet_name)

    df = pd.read_excel(xls, sheet_name=sheet_name)
    df.columns = [str(c).strip() for c in df.columns]

    # Validate columns
    is_valid, missing = validate_columns(df, sheet_name)
    if not is_valid:
        logger.error(
            "Sheet '%s' is missing required columns: %s - skipping",
            sheet_name,
            missing,
        )
        return [], 0

    meds: list[dict[str, Any]] = []
    warning_count = 0

    # Use to_dict('records') for better performance than iterrows()
    rows: list[dict[str, Any]] = df.to_dict("records")  # type: ignore[assignment]
    for row in rows:
        med_obj = process_row(row, sheet_name)
        if med_obj is None:
            continue

        # Validate medication
        warnings = validate_medication(med_obj)
        for warning in warnings:
            logger.warning(warning)
            warning_count += 1

        meds.append(med_obj)

    logger.info("  -> Added %d medications from %s", len(meds), sheet_name)
    return meds, warning_count


def load_excel(excel_path: Path) -> Optional[pd.ExcelFile]:
    """
    Load an Excel file with error handling.

    Args:
        excel_path: Path to the Excel file

    Returns:
        ExcelFile object, or None if loading failed
    """
    logger.info("Reading %s...", excel_path)

    try:
        return pd.ExcelFile(excel_path)
    except FileNotFoundError:
        logger.error("Could not find '%s'", excel_path)
        logger.error("Please check that the file path is correct.")
        return None
    except Exception as e:
        logger.error("Error reading Excel file: %s", e)
        return None


def write_json(output_path: Path, data: dict[str, Any]) -> bool:
    """
    Write data to JSON file with verification.

    Args:
        output_path: Path for output JSON file
        data: Dictionary to serialize

    Returns:
        True if successful, False otherwise
    """
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        # Verify the file
        with open(output_path, "r", encoding="utf-8") as f:
            verify = json.load(f)
            logger.info("JSON file is valid")
            logger.info("Contains %d medications", verify["source"]["record_count"])

        return True

    except Exception as e:
        logger.error("Error writing or verifying JSON file: %s", e)
        return False


def print_summary(meds: list[dict[str, Any]]) -> None:
    """Print specialty breakdown summary."""
    specialty_counts: dict[str, int] = {}
    for med in meds:
        spec = med["specialty"]
        specialty_counts[spec] = specialty_counts.get(spec, 0) + 1

    logger.info("Specialty breakdown:")
    for spec, count in sorted(specialty_counts.items()):
        logger.info("  %s: %d medications", spec, count)


# ---------------------------------------------------------------------------
# Main Conversion Function
# ---------------------------------------------------------------------------


def convert_excel_to_json(
    excel_path: Path,
    output_path: Path,
    interactive: bool = True,
) -> bool:
    """
    Convert Excel prescription data to JSON format.

    Args:
        excel_path: Path to input Excel file
        output_path: Path for output JSON file
        interactive: If True, pause for user input on completion/error

    Returns:
        True if conversion succeeded, False otherwise
    """
    logger.info("=" * 60)
    logger.info("PRESCRIPTION EXCEL TO JSON CONVERTER")
    logger.info("=" * 60)

    # Load Excel
    xls = load_excel(excel_path)
    if xls is None:
        if interactive:
            input("\nPress Enter to close...")
        return False

    logger.info("Found %d sheets:", len(xls.sheet_names))
    for sheet in xls.sheet_names:
        logger.info("  - %s", sheet)

    # Process all sheets
    all_meds: list[dict[str, Any]] = []
    total_warnings = 0

    for sheet_name in xls.sheet_names:
        meds, warnings = process_sheet(xls, str(sheet_name))
        all_meds.extend(meds)
        total_warnings += warnings

    if total_warnings > 0:
        logger.warning("Total validation warnings: %d", total_warnings)

    # Build output structure
    final_output = {
        "source": {
            "file": excel_path.name,
            "record_count": len(all_meds),
        },
        "meds": all_meds,
    }

    # Write JSON
    if not write_json(output_path, final_output):
        if interactive:
            input("\nPress Enter to close...")
        return False

    # Print summary
    print_summary(all_meds)

    logger.info("=" * 60)
    logger.info("CONVERSION COMPLETE!")
    logger.info("=" * 60)
    logger.info("Converted %d prescriptions to: %s", len(all_meds), output_path)

    return True


# ---------------------------------------------------------------------------
# CLI Interface
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    script_dir = Path(__file__).parent.resolve()

    parser = argparse.ArgumentParser(
        description="Convert prescription Excel file to JSON format.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=script_dir / DEFAULT_EXCEL_FILENAME,
        help=f"Input Excel file (default: {DEFAULT_EXCEL_FILENAME})",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=script_dir / DEFAULT_OUTPUT_FILENAME,
        help=f"Output JSON file (default: {DEFAULT_OUTPUT_FILENAME})",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run without pausing for user input (for automation)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose debug logging",
    )
    return parser.parse_args()


def main() -> int:
    """
    Main entry point for the converter.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    args = parse_args()
    setup_logging(verbose=args.verbose)

    interactive = not args.non_interactive

    try:
        success = convert_excel_to_json(
            excel_path=args.input,
            output_path=args.output,
            interactive=interactive,
        )
        return 0 if success else 1

    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        return 1

    finally:
        if interactive:
            print()
            input("Press Enter to close this window...")


if __name__ == "__main__":
    sys.exit(main())
