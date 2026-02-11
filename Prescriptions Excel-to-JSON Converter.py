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
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS: frozenset[str] = frozenset({"Med"})

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


def _is_empty(val: Any) -> bool:
    """Check if a cell value is empty, NaN, or blank string."""
    return pd.isna(val) or val == ""


def clean_text(val: Any) -> str:
    """Convert a cell value to a cleaned, stripped string.

    Returns empty string for null/NaN/empty values.
    """
    if _is_empty(val):
        return ""
    return str(val).strip()


def clean_refill(val: Any) -> str:
    """Normalize refill to a whole number string (e.g. 1.0 -> "1").

    Non-numeric text (e.g. "PRN") is preserved as-is.
    """
    if _is_empty(val):
        return ""
    try:
        return str(int(float(val)))
    except (ValueError, TypeError):
        return str(val).strip()


def parse_numeric(val: Any, field_name: str, row_context: str) -> float | None:
    """Parse a numeric value, logging a warning on failure."""
    if _is_empty(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        logger.warning(
            "Could not parse %s value '%s' for %s - treating as None",
            field_name, val, row_context,
        )
        return None


def parse_brands(raw_alias: Any) -> list[str]:
    """Parse comma-separated brand names into a list."""
    if _is_empty(raw_alias) or str(raw_alias).strip() == "":
        return []
    return [b.strip() for b in str(raw_alias).split(",") if b.strip()]


def build_search_text(components: list[str]) -> str:
    """Join non-empty components with ' | ' and lowercase."""
    return " | ".join(c for c in components if c).lower()


# ---------------------------------------------------------------------------
# Validation Functions
# ---------------------------------------------------------------------------


def validate_columns(df: pd.DataFrame, sheet_name: str) -> tuple[bool, list[str]]:
    """Check that required columns exist. Returns (is_valid, missing_columns)."""
    missing = REQUIRED_COLUMNS - set(df.columns)
    return len(missing) == 0, list(missing)


def validate_medication(med_obj: dict[str, Any]) -> list[str]:
    """Return a list of validation warnings for a medication object."""
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


def process_row(row: dict[str, Any], sheet_name: str) -> dict[str, Any] | None:
    """Process a single Excel row into a medication dict, or None to skip."""
    med_value = row.get("Med")
    if _is_empty(med_value) or str(med_value).strip() == "":
        return None

    med_name = clean_text(med_value)
    brands = parse_brands(row.get("Alias", ""))
    indication = clean_text(row.get("Indication", ""))
    dose_text = clean_text(row.get("Dose", ""))
    route = clean_text(row.get("Route", ""))
    frequency = clean_text(row.get("Frequency", ""))
    duration = clean_text(row.get("Duration", ""))
    dispense = clean_text(row.get("Dispense", ""))
    refill = clean_refill(row.get("Refill", ""))
    prn = clean_text(row.get("PRN", ""))
    form = clean_text(row.get("Form", ""))
    comments = clean_text(row.get("Comments", ""))
    population = clean_text(row.get("Population", ""))
    subcategory = clean_text(row.get("Subcategory", ""))

    dose_per_kg = parse_numeric(row.get("DosePerKg"), "DosePerKg", med_name)
    max_dose = parse_numeric(row.get("MaxDose"), "MaxDose", med_name)
    weight_based = dose_per_kg is not None and dose_per_kg > 0

    search_text = build_search_text([
        sheet_name, population, subcategory, indication,
        med_name, " ".join(brands), dose_text, prn, comments,
    ])

    return {
        "specialty": sheet_name,
        "med": med_name,
        "brands": brands,
        "indication": indication,
        "dose_text": dose_text,
        "route": route,
        "frequency": frequency,
        "duration": duration,
        "dispense": dispense,
        "refill": refill,
        "prn": prn,
        "form": form,
        "comments": comments,
        "population": population,
        "subcategory": subcategory,
        "weight_based": weight_based,
        "dose_per_kg_mg": dose_per_kg,
        "max_dose_mg": max_dose,
        "search_text": search_text,
    }


def process_sheet(
    xls: pd.ExcelFile, sheet_name: str,
) -> tuple[list[dict[str, Any]], int]:
    """Process a single Excel sheet into medication objects."""
    logger.info("Processing sheet: %s", sheet_name)

    df = pd.read_excel(xls, sheet_name=sheet_name)
    df.columns = [str(c).strip() for c in df.columns]

    is_valid, missing = validate_columns(df, sheet_name)
    if not is_valid:
        logger.error(
            "Sheet '%s' is missing required columns: %s - skipping",
            sheet_name, missing,
        )
        return [], 0

    meds: list[dict[str, Any]] = []
    warning_count = 0

    for row in df.to_dict("records"):
        med_obj = process_row(row, sheet_name)
        if med_obj is None:
            continue

        for warning in validate_medication(med_obj):
            logger.warning(warning)
            warning_count += 1

        meds.append(med_obj)

    logger.info("  -> Added %d medications from %s", len(meds), sheet_name)
    return meds, warning_count


def load_excel(excel_path: Path) -> pd.ExcelFile | None:
    """Load an Excel file, returning None on failure."""
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
    """Write data to JSON and verify the output."""
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

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
    counts = Counter(med["specialty"] for med in meds)
    logger.info("Specialty breakdown:")
    for spec, count in sorted(counts.items()):
        logger.info("  %s: %d medications", spec, count)


# ---------------------------------------------------------------------------
# Main Conversion Function
# ---------------------------------------------------------------------------


def convert_excel_to_json(excel_path: Path, output_path: Path) -> bool:
    """Convert Excel prescription data to JSON format.

    Returns True on success, False on failure.
    """
    logger.info("=" * 60)
    logger.info("PRESCRIPTION EXCEL TO JSON CONVERTER")
    logger.info("=" * 60)

    xls = load_excel(excel_path)
    if xls is None:
        return False

    logger.info("Found %d sheets:", len(xls.sheet_names))
    for sheet in xls.sheet_names:
        logger.info("  - %s", sheet)

    all_meds: list[dict[str, Any]] = []
    total_warnings = 0

    for sheet_name in xls.sheet_names:
        meds, warnings = process_sheet(xls, str(sheet_name))
        all_meds.extend(meds)
        total_warnings += warnings

    if total_warnings > 0:
        logger.warning("Total validation warnings: %d", total_warnings)

    final_output = {
        "source": {
            "file": excel_path.name,
            "record_count": len(all_meds),
        },
        "meds": all_meds,
    }

    if not write_json(output_path, final_output):
        return False

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
    """Entry point. Returns 0 on success, 1 on failure."""
    args = parse_args()
    setup_logging(verbose=args.verbose)

    interactive = not args.non_interactive

    try:
        success = convert_excel_to_json(
            excel_path=args.input,
            output_path=args.output,
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
