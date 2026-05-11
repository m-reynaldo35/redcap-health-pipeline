"""
Base extractor — loads a YAML field config and runs regex patterns against PDF text.
All modality extractors inherit from this.
"""
import io
import re
from pathlib import Path
from typing import Any

import pdfplumber
import yaml


CONFIG_DIR = Path(__file__).parent.parent / "config"


class BaseExtractor:
    config_file: str  # subclasses set this, e.g. "ecg_fields.yaml"

    def __init__(self) -> None:
        config_path = CONFIG_DIR / self.config_file
        with open(config_path) as f:
            self._config = yaml.safe_load(f)

    def extract(self, file_bytes: bytes) -> dict[str, Any]:
        text = self._extract_text(file_bytes)
        result: dict[str, Any] = {}

        for field_name, field_def in self._config.get("fields", {}).items():
            value = self._match_field(text, field_def)
            redcap_var = field_def.get("redcap_var", field_name)
            result[redcap_var] = value

        for cb_name, cb_def in self._config.get("checkboxes", {}).items():
            value = self._match_checkbox(text, cb_def)
            redcap_var = cb_def.get("redcap_var", cb_name)
            result[redcap_var] = value

        return result

    def _extract_text(self, file_bytes: bytes) -> str:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)

    def _match_field(self, text: str, field_def: dict) -> str:
        field_type = field_def.get("type", "string")
        for pattern in field_def.get("patterns", []):
            match = re.search(pattern, text)
            if match:
                raw = match.group(1).strip()
                return self._coerce(raw, field_type)
        return ""

    # Words that negate a keyword match on the same line
    _NEGATION = re.compile(
        r'(?i)\b(no|without|absent|not|no evidence of|no sign of|rules? out|ruled out|excludes?)\b'
    )

    def _match_checkbox(self, text: str, cb_def: dict) -> str:
        for pattern in cb_def.get("keyword_patterns", []):
            match = re.search(pattern, text)
            if not match:
                continue
            # Check the line containing the match for negation words
            line_start = text.rfind("\n", 0, match.start()) + 1
            line_end = text.find("\n", match.end())
            line = text[line_start: line_end if line_end != -1 else len(text)]
            # Only treat as negated if the negation word appears before the keyword on the same line
            negation_match = self._NEGATION.search(line)
            if negation_match and negation_match.start() < (match.start() - line_start):
                continue
            return "1"
        return "0"

    def _coerce(self, value: str, field_type: str) -> str:
        if field_type == "integer":
            digits = re.search(r"-?\d+", value)
            return digits.group(0) if digits else value
        if field_type == "float":
            number = re.search(r"-?[\d\.]+", value)
            return number.group(0) if number else value
        if field_type == "date":
            return self._normalise_date(value)
        return value.strip()

    @staticmethod
    def _normalise_date(raw: str) -> str:
        """Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD (REDCap format)."""
        match = re.match(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})", raw)
        if match:
            day, month, year = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        # already YYYY-MM-DD
        match = re.match(r"(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})", raw)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return raw
