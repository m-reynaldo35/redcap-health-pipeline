"""
Field Mapper — Module 3
Validates extracted fields against a REDCap Data Dictionary and coerces values
into the exact format REDCap expects.

Works in two modes:
  - Permissive (no Data Dictionary): passes through with basic type checks
  - Strict (Data Dictionary loaded): validates types, ranges, and variable names
"""
import csv
import re
from dataclasses import dataclass, field
from io import StringIO
from pathlib import Path
from typing import Any


# REDCap Data Dictionary column names
_COL_VAR = "Variable / Field Name"
_COL_TYPE = "Field Type"
_COL_VALIDATION = "Text Validation Type OR Show Slider Number"
_COL_MIN = "Text Validation Min"
_COL_MAX = "Text Validation Max"
_COL_CHOICES = "Choices, Calculations, OR Slider Labels"


@dataclass
class MappingResult:
    record_id: str
    fields: dict[str, str]
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


class FieldMapper:
    def __init__(self) -> None:
        self._dd: dict[str, dict[str, str]] = {}  # variable_name → DD row
        self._has_dd = False

    # ------------------------------------------------------------------
    # Data Dictionary management
    # ------------------------------------------------------------------

    def load_data_dictionary(self, content: str) -> int:
        """Parse a REDCap Data Dictionary CSV string. Returns number of fields loaded."""
        reader = csv.DictReader(StringIO(content))
        self._dd = {}
        for row in reader:
            var = row.get(_COL_VAR, "").strip()
            if var:
                self._dd[var] = row
        self._has_dd = bool(self._dd)
        return len(self._dd)

    def load_data_dictionary_file(self, path: Path) -> int:
        return self.load_data_dictionary(path.read_text(encoding="utf-8-sig"))

    @property
    def has_data_dictionary(self) -> bool:
        return self._has_dd

    def data_dictionary_fields(self) -> list[str]:
        return list(self._dd.keys())

    # ------------------------------------------------------------------
    # Mapping
    # ------------------------------------------------------------------

    def map(self, extracted: dict[str, Any], record_id: str) -> MappingResult:
        result = MappingResult(record_id=record_id, fields={"record_id": record_id})
        warnings: list[str] = []
        errors: list[str] = []

        for var, raw_value in extracted.items():
            value = str(raw_value).strip() if raw_value is not None else ""

            if self._has_dd:
                if var not in self._dd:
                    warnings.append(f"'{var}' not found in Data Dictionary — skipped")
                    continue
                validated, issue = self._validate_against_dd(var, value)
                if issue:
                    warnings.append(f"'{var}': {issue}")
                result.fields[var] = validated
            else:
                result.fields[var] = self._basic_coerce(var, value)

        result.warnings = warnings
        result.errors = errors
        return result

    # ------------------------------------------------------------------
    # Validation helpers
    # ------------------------------------------------------------------

    def _validate_against_dd(self, var: str, value: str) -> tuple[str, str]:
        """Returns (coerced_value, warning_message). warning_message is empty if clean."""
        dd_row = self._dd[var]
        field_type = dd_row.get(_COL_TYPE, "").lower()
        validation = dd_row.get(_COL_VALIDATION, "").lower()
        v_min = dd_row.get(_COL_MIN, "").strip()
        v_max = dd_row.get(_COL_MAX, "").strip()

        if not value:
            return "", ""

        # Checkbox fields — REDCap stores checkbox sub-fields as fieldname___N
        if field_type == "checkbox":
            if value not in ("0", "1"):
                return "0", f"checkbox value '{value}' is not 0 or 1, defaulting to 0"
            return value, ""

        # Date fields
        if validation in ("date_dmy", "date_mdy", "date_ymd"):
            normalised = _normalise_date(value)
            if not normalised:
                return "", f"could not parse date '{value}'"
            return normalised, ""

        # Integer / number fields
        if validation in ("integer", "number", "number_2dp"):
            try:
                num = float(value)
                if v_min and num < float(v_min):
                    return value, f"value {value} is below minimum {v_min}"
                if v_max and num > float(v_max):
                    return value, f"value {value} exceeds maximum {v_max}"
                if validation == "integer":
                    return str(int(num)), ""
                return value, ""
            except ValueError:
                return "", f"expected number, got '{value}'"

        # Radio / dropdown — value should be a valid code
        if field_type in ("radio", "dropdown"):
            choices_raw = dd_row.get(_COL_CHOICES, "")
            valid_codes = _parse_choices(choices_raw)
            if valid_codes and value not in valid_codes:
                return value, f"'{value}' not in valid choices {valid_codes}"

        return value, ""

    @staticmethod
    def _basic_coerce(var: str, value: str) -> str:
        """Minimal coercion when no Data Dictionary is available."""
        if not value:
            return ""
        # Normalise any date-looking value
        normalised = _normalise_date(value)
        if normalised:
            return normalised
        return value


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _normalise_date(raw: str) -> str:
    """Return YYYY-MM-DD or empty string if not parseable."""
    m = re.match(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$", raw.strip())
    if m:
        day, month, year = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    m = re.match(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$", raw.strip())
    if m:
        year, month, day = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return ""


def _parse_choices(choices_raw: str) -> list[str]:
    """Parse REDCap choices string '1, Label | 2, Label' → ['1', '2']."""
    if not choices_raw:
        return []
    codes = []
    for part in choices_raw.split("|"):
        code = part.strip().split(",")[0].strip()
        if code:
            codes.append(code)
    return codes


# Singleton — shared across all requests
mapper = FieldMapper()
