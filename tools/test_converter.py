#!/opt/homebrew/bin/python3
"""
Unit tests for Prescription Excel-to-JSON Converter.

Run with: pytest test_converter.py -v
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import pandas as pd
import pytest

import prescription_converter as converter


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------


def _make_row(**overrides: Any) -> dict[str, Any]:
    """Create a minimal medication row with sensible defaults.

    Only specify the fields relevant to each test; everything else
    gets a safe empty/None value.
    """
    row: dict[str, Any] = {
        "Med": "TestMed", "Alias": "", "Indication": "", "Dose": "",
        "Route": "", "Frequency": "", "Duration": "", "Dispense": "",
        "Refill": "", "PRN": "", "Form": "", "Comments": "",
        "Population": "", "Subcategory": "", "DosePerKg": None,
        "MaxDose": None,
    }
    row.update(overrides)
    return row


# ---------------------------------------------------------------------------
# Unit Tests: Helper Functions
# ---------------------------------------------------------------------------


class TestIsEmpty:
    """Tests for _is_empty function."""

    @pytest.mark.parametrize("input_val,expected", [
        ("", True),
        ("  ", True),
        (None, True),
        (float("nan"), True),
        (False, True),
        ("hello", False),
        (0, False),
        (0.0, False),
        ("0", False),
        (True, False),
    ])
    def test_is_empty_cases(self, input_val: Any, expected: bool) -> None:
        """Test _is_empty handles various inputs correctly."""
        result = converter._is_empty(input_val)
        assert result == expected


class TestCleanText:
    """Tests for clean_text function."""

    @pytest.mark.parametrize("input_val,expected", [
        ("hello", "hello"),
        ("  hello  ", "hello"),
        ("", ""),
        (None, ""),
        (float("nan"), ""),
        (123, "123"),
        (1.5, "1.5"),
        ("  multiple   words  ", "multiple   words"),
    ])
    def test_clean_text_cases(self, input_val: Any, expected: str) -> None:
        """Test clean_text handles various inputs correctly."""
        result = converter.clean_text(input_val)
        assert result == expected


class TestCleanRefill:
    """Tests for clean_refill function."""

    @pytest.mark.parametrize("input_val,expected", [
        (1.0, "1"),
        (0.0, "0"),
        ("1", "1"),
        ("1.0", "1"),
        ("", ""),
        (None, ""),
        (float("nan"), ""),
        ("PRN", "PRN"),  # Non-numeric text preserved
        (2.9, "2"),  # Truncates, doesn't round
    ])
    def test_clean_refill_cases(self, input_val: Any, expected: str) -> None:
        """Test clean_refill normalizes refill values correctly."""
        result = converter.clean_refill(input_val)
        assert result == expected


class TestParseNumeric:
    """Tests for parse_numeric function."""

    def test_valid_float(self) -> None:
        """Test parsing valid float values."""
        assert converter.parse_numeric(1.5, "test", "context") == 1.5
        assert converter.parse_numeric("2.5", "test", "context") == 2.5
        assert converter.parse_numeric(0, "test", "context") == 0.0

    def test_empty_values(self) -> None:
        """Test empty values return None."""
        assert converter.parse_numeric("", "test", "context") is None
        assert converter.parse_numeric(None, "test", "context") is None
        assert converter.parse_numeric(float("nan"), "test", "context") is None

    def test_invalid_string(self, caplog: pytest.LogCaptureFixture) -> None:
        """Test invalid strings return None with warning."""
        result = converter.parse_numeric("0.5 mg/kg", "DosePerKg", "Ibuprofen")
        assert result is None
        assert "Could not parse DosePerKg" in caplog.text


class TestParseBrands:
    """Tests for parse_brands function."""

    @pytest.mark.parametrize("input_val,expected", [
        ("Advil, Motrin", ["Advil", "Motrin"]),
        ("Advil,Motrin", ["Advil", "Motrin"]),
        ("  Advil  ,  Motrin  ", ["Advil", "Motrin"]),
        ("SingleBrand", ["SingleBrand"]),
        ("", []),
        (None, []),
        (float("nan"), []),
        ("Brand1, , Brand2", ["Brand1", "Brand2"]),  # Empty segments filtered
    ])
    def test_parse_brands_cases(self, input_val: Any, expected: list[str]) -> None:
        """Test parse_brands handles various inputs correctly."""
        result = converter.parse_brands(input_val)
        assert result == expected


class TestBuildSearchText:
    """Tests for build_search_text function."""

    def test_combines_components(self) -> None:
        """Test components are joined correctly."""
        components = ["Allergy", "Adult", "Cetirizine"]
        result = converter.build_search_text(components)
        assert result == "allergy | adult | cetirizine"

    def test_filters_empty(self) -> None:
        """Test empty components are filtered out."""
        components = ["Allergy", "", "Cetirizine", None, "Adult"]
        result = converter.build_search_text(components)
        assert result == "allergy | cetirizine | adult"

    def test_lowercases(self) -> None:
        """Test output is lowercased."""
        components = ["UPPER", "Mixed", "lower"]
        result = converter.build_search_text(components)
        assert result == "upper | mixed | lower"

    def test_sanitizes_pipe(self) -> None:
        """Test pipe characters in components don't collide with delimiter."""
        components = ["category", "med|name", "dose"]
        result = converter.build_search_text(components)
        assert "med name" in result
        assert result.count("|") == 2  # only the delimiters


# ---------------------------------------------------------------------------
# Unit Tests: Validation Functions
# ---------------------------------------------------------------------------


class TestValidateColumns:
    """Tests for validate_columns function."""

    def test_valid_columns(self) -> None:
        """Test valid DataFrame passes validation."""
        df = pd.DataFrame({"Med": ["Test"], "Other": ["Value"]})
        missing = converter.validate_columns(df)
        assert missing == []

    def test_missing_required(self) -> None:
        """Test missing required column fails validation."""
        df = pd.DataFrame({"Other": ["Value"]})
        missing = converter.validate_columns(df)
        assert "Med" in missing


class TestValidateMedication:
    """Tests for validate_medication function."""

    def test_valid_medication(self) -> None:
        """Test valid medication has no warnings."""
        med = {
            "med": "Ibuprofen",
            "dose_text": "400mg",
            "weight_based": False,
            "specialty": "Analgesia",
        }
        warnings = converter.validate_medication(med)
        assert warnings == []

    def test_empty_med_name(self) -> None:
        """Test empty medication name generates warning."""
        med = {
            "med": "",
            "dose_text": "400mg",
            "weight_based": False,
            "specialty": "Analgesia",
        }
        warnings = converter.validate_medication(med)
        assert len(warnings) == 1
        assert "Empty medication name" in warnings[0]

    def test_missing_dose_non_weight_based(self) -> None:
        """Test missing dose for non-weight-based generates warning."""
        med = {
            "med": "Ibuprofen",
            "dose_text": "",
            "weight_based": False,
            "specialty": "Analgesia",
        }
        warnings = converter.validate_medication(med)
        assert len(warnings) == 1
        assert "No dose specified" in warnings[0]

    def test_weight_based_no_dose_ok(self) -> None:
        """Test weight-based medications don't need dose_text."""
        med = {
            "med": "Amoxicillin",
            "dose_text": "",
            "weight_based": True,
            "max_dose_mg": 500.0,
            "specialty": "Anti-infective",
        }
        warnings = converter.validate_medication(med)
        assert warnings == []

    def test_weight_based_missing_max_dose(self) -> None:
        """Test weight-based medication without max dose generates warning."""
        med = {
            "med": "Amoxicillin",
            "dose_text": "",
            "weight_based": True,
            "max_dose_mg": None,
            "specialty": "Anti-infective",
        }
        warnings = converter.validate_medication(med)
        assert len(warnings) == 1
        assert "missing max dose" in warnings[0]

    def test_weight_based_zero_max_dose_ok(self) -> None:
        """Test max_dose_mg=0.0 does not falsely trigger 'missing max dose'."""
        med = {
            "med": "TestMed",
            "dose_text": "",
            "weight_based": True,
            "max_dose_mg": 0.0,
            "specialty": "Test",
        }
        warnings = converter.validate_medication(med)
        assert not any("missing max dose" in w for w in warnings)


# ---------------------------------------------------------------------------
# Unit Tests: Row Processing
# ---------------------------------------------------------------------------


class TestProcessRow:
    """Tests for process_row function."""

    def test_basic_row(self) -> None:
        """Test processing a basic medication row."""
        row = {
            "Med": "Ibuprofen",
            "Alias": "Advil, Motrin",
            "Indication": "Pain",
            "Dose": "400mg",
            "Route": "PO",
            "Frequency": "TID",
            "Duration": "7 day",
            "Dispense": "21 tab",
            "Refill": 0,
            "PRN": "pain",
            "Form": "tab",
            "Comments": "Take with food",
            "Population": "Adult",
            "Subcategory": "Analgesia",
            "DosePerKg": None,
            "MaxDose": None,
        }
        result = converter.process_row(row, "Test Specialty")

        assert result is not None
        assert result["med"] == "Ibuprofen"
        assert result["brands"] == ["Advil", "Motrin"]
        assert result["specialty"] == "Test Specialty"
        assert result["weight_based"] is False
        assert "ibuprofen" in result["search_text"]

    def test_empty_med_skipped(self) -> None:
        """Test rows with empty Med are skipped."""
        row = {"Med": "", "Dose": "400mg"}
        result = converter.process_row(row, "Test")
        assert result is None

    def test_nan_med_skipped(self) -> None:
        """Test rows with NaN Med are skipped."""
        row = {"Med": float("nan"), "Dose": "400mg"}
        result = converter.process_row(row, "Test")
        assert result is None

    def test_weight_based_detection(self) -> None:
        """Test weight-based medication detection."""
        row = _make_row(Med="Amoxicillin", DosePerKg=25.0, MaxDose=500.0)
        result = converter.process_row(row, "Anti-infective")

        assert result is not None
        assert result["weight_based"] is True
        assert result["dose_per_kg_mg"] == 25.0
        assert result["max_dose_mg"] == 500.0

    def test_missing_optional_columns(self) -> None:
        """Test handling of missing optional columns."""
        row = {"Med": "TestMed"}  # only required column
        result = converter.process_row(row, "Test")

        assert result is not None
        assert result["med"] == "TestMed"
        assert result["brands"] == []
        assert result["dose_text"] == ""
        assert result["weight_based"] is False

    def test_weight_based_from_excel_column(self) -> None:
        """Test WeightBased column is used when present."""
        row = _make_row(WeightBased=True, DosePerKg=10.0, MaxDose=500.0)
        result = converter.process_row(row, "Test")
        assert result is not None
        assert result["weight_based"] is True

    def test_weight_based_mismatch_warns(self, caplog: pytest.LogCaptureFixture) -> None:
        """Test warning when WeightBased column disagrees with DosePerKg."""
        row = _make_row(WeightBased=True, DosePerKg=None)
        result = converter.process_row(row, "Test")
        assert result is not None
        assert result["weight_based"] is True
        assert "mismatch" in caplog.text.lower()

    def test_weight_based_fallback_without_column(self) -> None:
        """Test derived weight_based when WeightBased column is absent."""
        row = _make_row(DosePerKg=5.0, MaxDose=100.0)
        result = converter.process_row(row, "Test")
        assert result is not None
        assert result["weight_based"] is True


# ---------------------------------------------------------------------------
# Integration Tests: Full Conversion
# ---------------------------------------------------------------------------


class TestFullConversion:
    """Integration tests for full Excel-to-JSON conversion."""

    @pytest.fixture
    def sample_excel(self, tmp_path: Path) -> Path:
        """Create a sample Excel file for testing."""
        excel_path = tmp_path / "test_prescriptions.xlsx"

        # Create sample data
        data = {
            "Med": ["Ibuprofen", "Acetaminophen", ""],  # Empty row to skip
            "Alias": ["Advil, Motrin", "Tylenol", ""],
            "Indication": ["Pain", "Fever", ""],
            "Dose": ["400mg", "500mg", ""],
            "Route": ["PO", "PO", ""],
            "Frequency": ["TID", "QID", ""],
            "Duration": ["7 day", "5 day", ""],
            "Dispense": ["21 tab", "20 tab", ""],
            "Refill": [0, 1, 0],
            "PRN": ["pain", "fever", ""],
            "Form": ["tab", "tab", ""],
            "Comments": ["Take with food", "", ""],
            "Population": ["Adult", "Adult", ""],
            "Subcategory": ["Analgesia", "Analgesia", ""],
            "DosePerKg": [None, None, None],
            "MaxDose": [None, None, None],
        }
        df = pd.DataFrame(data)

        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Analgesia", index=False)

        return excel_path

    def test_full_conversion(self, sample_excel: Path, tmp_path: Path) -> None:
        """Test full conversion from Excel to JSON."""
        output_path = tmp_path / "output.json"

        result = converter.convert_excel_to_json(
            excel_path=sample_excel,
            output_path=output_path,
        )

        assert result is True
        assert output_path.exists()

        with open(output_path) as f:
            data = json.load(f)

        assert data["source"]["record_count"] == 2  # Empty row skipped
        assert len(data["meds"]) == 2

        # Verify first medication
        ibuprofen = data["meds"][0]
        assert ibuprofen["med"] == "Ibuprofen"
        assert ibuprofen["brands"] == ["Advil", "Motrin"]
        assert ibuprofen["specialty"] == "Analgesia"

    def test_output_dir_created(self, sample_excel: Path, tmp_path: Path) -> None:
        """Test output directory is created if it doesn't exist."""
        output_path = tmp_path / "subdir" / "nested" / "output.json"
        result = converter.convert_excel_to_json(
            excel_path=sample_excel,
            output_path=output_path,
        )
        assert result is True
        assert output_path.exists()

    def test_missing_file(self, tmp_path: Path) -> None:
        """Test handling of missing input file."""
        result = converter.convert_excel_to_json(
            excel_path=tmp_path / "nonexistent.xlsx",
            output_path=tmp_path / "output.json",
        )
        assert result is False

    def test_invalid_excel_structure(self, tmp_path: Path) -> None:
        """Test handling of Excel without required columns."""
        excel_path = tmp_path / "invalid.xlsx"
        df = pd.DataFrame({"WrongColumn": ["Value"]})
        df.to_excel(excel_path, index=False)

        output_path = tmp_path / "output.json"
        result = converter.convert_excel_to_json(
            excel_path=excel_path,
            output_path=output_path,
        )

        # Should succeed but with 0 medications
        assert result is True
        with open(output_path) as f:
            data = json.load(f)
        assert data["source"]["record_count"] == 0


# ---------------------------------------------------------------------------
# Edge Case Tests
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_unicode_handling(self) -> None:
        """Test Unicode characters are handled correctly."""
        row = _make_row(Med="Test Med with Unicode: >= 30kg")
        result = converter.process_row(row, "Test")
        assert result is not None
        assert ">=" in result["med"]

    def test_zero_dose_per_kg(self) -> None:
        """Test that dose_per_kg of exactly 0 is not weight-based."""
        row = _make_row(Dose="100mg", DosePerKg=0.0)
        result = converter.process_row(row, "Test")
        assert result is not None
        assert result["weight_based"] is False
        assert result["dose_per_kg_mg"] == 0.0

    def test_whitespace_only_med(self) -> None:
        """Test whitespace-only Med is treated as empty."""
        row = _make_row(Med="   ")
        result = converter.process_row(row, "Test")
        assert result is None

    def test_large_numeric_values(self) -> None:
        """Test handling of large numeric values."""
        result = converter.parse_numeric(999999.999, "test", "context")
        assert result == 999999.999

    def test_negative_dose_parsed(self) -> None:
        """Test parse_numeric accepts negative values (validation catches them)."""
        result = converter.parse_numeric(-5.0, "DosePerKg", "TestMed")
        assert result == -5.0

    def test_negative_dose_per_kg_flagged(self) -> None:
        """Test negative dose_per_kg generates a validation warning."""
        med = {
            "med": "TestMed",
            "dose_text": "",
            "weight_based": False,
            "dose_per_kg_mg": -5.0,
            "max_dose_mg": None,
            "specialty": "Test",
        }
        warnings = converter.validate_medication(med)
        assert any("Negative dose_per_kg" in w for w in warnings)


# ---------------------------------------------------------------------------
# Run Tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
