#!/usr/bin/env python3
"""
Prescription Excel-to-JSON Converter

Converts a multi-sheet Excel workbook of medical prescriptions into a structured
JSON file for use by the ED Prescriptions web application.

Usage:
    python prescription_converter.py
    python prescription_converter.py --non-interactive
    python prescription_converter.py --input custom.xlsx --output custom.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS: frozenset[str] = frozenset({"Med"})

_FALSY_STRINGS: frozenset[str] = frozenset({"false", "no", "n", "0", "off", ""})

DEFAULT_EXCEL_FILENAME: str = "Prescriptions.xlsx"
DEFAULT_OUTPUT_FILENAME: str = "Prescriptions.json"

# Maps Excel column names to output JSON keys for simple text fields.
_TEXT_FIELD_MAP: dict[str, str] = {
    "Indication": "indication",
    "Dose": "dose_text",
    "Route": "route",
    "Frequency": "frequency",
    "Duration": "duration",
    "Dispense": "dispense",
    "PRN": "prn",
    "Form": "form",
    "Comments": "comments",
    "Population": "population",
    "Subcategory": "subcategory",
}

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
    """Check if a cell value is empty, NaN, or whitespace-only.

    Boolean False is treated as empty (common in Excel for 'not set').
    Must be checked before pd.isna since bool is a subclass of int.
    """
    if isinstance(val, bool):
        return not val
    if pd.isna(val):
        return True
    return isinstance(val, str) and val.strip() == ""


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
    if _is_empty(raw_alias):
        return []
    return [b.strip() for b in str(raw_alias).split(",") if b.strip()]


def _parse_bool(val: Any) -> bool:
    """Parse a value as boolean, handling Excel string representations.

    Handles Python bools, numbers, and common string representations
    like "TRUE"/"FALSE", "Yes"/"No", "1"/"0".
    """
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() not in _FALSY_STRINGS
    return bool(val)


def build_search_text(components: list[str | None]) -> str:
    """Join non-empty string components with ' | ' and lowercase.

    Pipe characters within components are replaced with spaces to
    avoid collisions with the delimiter. Empty strings and None are
    filtered out.
    """
    return " | ".join(
        c.replace("|", " ") for c in components if isinstance(c, str) and c
    ).lower()


# ---------------------------------------------------------------------------
# Validation Functions
# ---------------------------------------------------------------------------


def validate_columns(df: pd.DataFrame) -> list[str]:
    """Return list of missing required columns (empty if all present)."""
    return sorted(REQUIRED_COLUMNS - set(df.columns))


def validate_medication(med_obj: dict[str, Any]) -> list[str]:
    """Return a list of validation warnings for a medication object."""
    warnings: list[str] = []
    med_name = med_obj.get("med", "Unknown")

    if not med_obj.get("med"):
        warnings.append(f"Empty medication name in {med_obj.get('specialty', 'Unknown')}")

    if not med_obj.get("dose_text") and not med_obj.get("weight_based"):
        warnings.append(f"No dose specified for non-weight-based medication: {med_name}")

    if med_obj.get("weight_based") and med_obj.get("max_dose_mg") is None:
        warnings.append(f"Weight-based medication missing max dose: {med_name}")

    dose_per_kg = med_obj.get("dose_per_kg_mg")
    if dose_per_kg is not None and dose_per_kg < 0:
        warnings.append(f"Negative dose_per_kg ({dose_per_kg}) for: {med_name}")

    return warnings


# ---------------------------------------------------------------------------
# Core Conversion Logic
# ---------------------------------------------------------------------------


def _resolve_weight_based(
    med_name: str, dose_per_kg: float | None, raw_wb: Any,
) -> bool:
    """Determine if a medication is weight-based.

    Uses the explicit WeightBased column when present; otherwise derives
    from DosePerKg > 0. Logs a warning if the two disagree.
    """
    derived = dose_per_kg is not None and dose_per_kg > 0
    # Intentionally NOT using _is_empty here: _is_empty(False) == True,
    # but an explicit False in WeightBased is a meaningful value.
    if raw_wb is None or pd.isna(raw_wb):
        return derived
    explicit = _parse_bool(raw_wb)
    if explicit != derived:
        logger.warning(
            "WeightBased mismatch for %s: column=%s, DosePerKg=%s",
            med_name, raw_wb, dose_per_kg,
        )
    return explicit


def process_row(row: dict[str, Any], sheet_name: str) -> dict[str, Any] | None:
    """Process a single Excel row into a medication dict, or None to skip."""
    if _is_empty(row.get("Med")):
        return None

    med_name = clean_text(row["Med"])
    brands = parse_brands(row.get("Alias"))

    # Batch-clean all simple text fields via the column map.
    fields = {key: clean_text(row.get(col)) for col, key in _TEXT_FIELD_MAP.items()}

    refill = clean_refill(row.get("Refill"))
    dose_per_kg = parse_numeric(row.get("DosePerKg"), "DosePerKg", med_name)
    max_dose = parse_numeric(row.get("MaxDose"), "MaxDose", med_name)
    weight_based = _resolve_weight_based(med_name, dose_per_kg, row.get("WeightBased"))

    search_text = build_search_text([
        sheet_name, fields["population"], fields["subcategory"],
        fields["indication"], med_name, " ".join(brands),
        fields["dose_text"], fields["prn"], fields["comments"],
    ])

    return {
        "specialty": sheet_name,
        "med": med_name,
        "brands": brands,
        **fields,
        "refill": refill,
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

    missing = validate_columns(df)
    if missing:
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


def write_file_atomically(
    output_path: Path, content: str, *, suffix: str = ".tmp",
) -> None:
    """Write content to a file atomically via temp-file-then-rename.

    Creates parent directories if needed. On failure, cleans up the
    temp file and re-raises so callers can handle the error.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(suffix=suffix, dir=output_path.parent)
    tmp_path = Path(tmp_name)
    try:
        with open(fd, "w", encoding="utf-8") as f:
            f.write(content)
        tmp_path.replace(output_path)
    except BaseException:
        if tmp_path.exists():
            tmp_path.unlink()
        raise


def write_json(output_path: Path, data: dict[str, Any]) -> bool:
    """Serialize data as JSON and write atomically."""
    try:
        write_file_atomically(
            output_path, json.dumps(data, indent=2), suffix=".json",
        )
        return True
    except Exception as e:
        logger.error("Error writing JSON file: %s", e)
        return False


def _log_summary(meds: list[dict[str, Any]]) -> None:
    """Log specialty breakdown summary."""
    counts = Counter(med["specialty"] for med in meds)
    logger.info("Specialty breakdown:")
    for spec, count in sorted(counts.items()):
        logger.info("  %s: %d medications", spec, count)


# ---------------------------------------------------------------------------
# Main Conversion Function
# ---------------------------------------------------------------------------


def convert_excel(excel_path: Path) -> dict[str, Any] | None:
    """Convert Excel prescription data to a dict.

    Returns the data dict on success, None on failure.
    """
    xls = load_excel(excel_path)
    if xls is None:
        return None

    with xls:
        logger.info("Found %d sheets", len(xls.sheet_names))
        for sheet in xls.sheet_names:
            logger.debug("  %s", sheet)

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

    _log_summary(all_meds)
    logger.info("Converted %d prescriptions", len(all_meds))

    return final_output


def convert_excel_to_json(excel_path: Path, output_path: Path) -> bool:
    """Convert Excel prescription data to JSON format.

    Returns True on success, False on failure.
    """
    data = convert_excel(excel_path)
    if data is None:
        return False

    if not write_json(output_path, data):
        return False

    logger.info(
        "Wrote %d prescriptions to %s",
        data["source"]["record_count"], output_path,
    )
    return True


# ---------------------------------------------------------------------------
# CLI Interface
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    data_dir = (Path(__file__).parent.resolve() / ".." / "data").resolve()

    parser = argparse.ArgumentParser(
        description="Convert prescription Excel file to JSON format.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input", "-i",
        type=Path,
        default=data_dir / DEFAULT_EXCEL_FILENAME,
        help=f"Input Excel file (default: data/{DEFAULT_EXCEL_FILENAME})",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=data_dir / DEFAULT_OUTPUT_FILENAME,
        help=f"Output JSON file (default: data/{DEFAULT_OUTPUT_FILENAME})",
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
        logger.info("=" * 60)
        logger.info("PRESCRIPTION EXCEL TO JSON CONVERTER")
        logger.info("=" * 60)

        success = convert_excel_to_json(
            excel_path=args.input,
            output_path=args.output,
        )
        return 0 if success else 1

    except Exception:
        logger.exception("Unexpected error")
        return 1

    finally:
        if interactive:
            print()
            input("Press Enter to close this window...")


if __name__ == "__main__":
    sys.exit(main())
