"""
REDCap Stripper — Module 5
Cleans a raw REDCap data export CSV for statistical analysis.

Handles:
- REDCap missing data codes → NaN
- Checkbox column expansion (fieldname___1 → readable label)
- Column renaming via Data Dictionary labels
- Date range filtering
"""
import re
from dataclasses import dataclass, field
from io import StringIO

import pandas as pd


# REDCap encodes missing / not-answered as these values
_MISSING_CODES = {"", ".", "-999", "-9", "N/A", "n/a", "NA"}


@dataclass
class StripResult:
    df: pd.DataFrame
    original_row_count: int
    filtered_row_count: int
    columns_renamed: int
    checkboxes_expanded: int
    warnings: list[str] = field(default_factory=list)

    @property
    def rows_dropped(self) -> int:
        return self.original_row_count - self.filtered_row_count


class REDCapStripper:
    def strip(
        self,
        export_csv: str,
        data_dict: dict[str, dict] | None = None,
        date_column: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        rename_columns: bool = True,
        expand_checkboxes: bool = True,
    ) -> StripResult:
        warnings: list[str] = []

        try:
            df = pd.read_csv(StringIO(export_csv), dtype=str)
        except Exception as e:
            raise ValueError(f"Could not parse CSV: {e}")

        original_count = len(df)

        # Replace REDCap missing codes with NaN
        df = df.replace(list(_MISSING_CODES), pd.NA)

        cols_renamed = 0
        checkboxes_expanded = 0

        if data_dict:
            # Build label map: variable_name → Field Label
            label_map: dict[str, str] = {}
            choices_map: dict[str, dict[str, str]] = {}  # variable → {code: label}

            for var, row in data_dict.items():
                label = row.get("Field Label", "").strip()
                if label:
                    label_map[var] = _clean_label(label)
                choices_raw = row.get("Choices, Calculations, OR Slider Labels", "")
                if choices_raw:
                    choices_map[var] = _parse_choices(choices_raw)

            if expand_checkboxes:
                df, extra = _expand_checkbox_columns(df, choices_map, label_map)
                checkboxes_expanded = extra

            if rename_columns:
                rename = {}
                for col in df.columns:
                    if col in label_map:
                        rename[col] = label_map[col]
                df = df.rename(columns=rename)
                cols_renamed = len(rename)

        # Date range filter
        if date_column and (date_from or date_to):
            if date_column in df.columns:
                df, dropped = _filter_dates(df, date_column, date_from, date_to)
                if dropped:
                    warnings.append(f"Date filter dropped {dropped} rows outside range")
            else:
                warnings.append(f"Date column '{date_column}' not found — filter skipped")

        return StripResult(
            df=df,
            original_row_count=original_count,
            filtered_row_count=len(df),
            columns_renamed=cols_renamed,
            checkboxes_expanded=checkboxes_expanded,
            warnings=warnings,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_label(label: str) -> str:
    """Strip HTML tags and normalise whitespace from REDCap field labels."""
    label = re.sub(r"<[^>]+>", "", label)
    return " ".join(label.split())


def _parse_choices(raw: str) -> dict[str, str]:
    """'1, Normal | 2, Abnormal' → {'1': 'Normal', '2': 'Abnormal'}"""
    result = {}
    for part in raw.split("|"):
        part = part.strip()
        if "," in part:
            code, _, label = part.partition(",")
            result[code.strip()] = label.strip()
    return result


def _expand_checkbox_columns(
    df: pd.DataFrame,
    choices_map: dict[str, dict[str, str]],
    label_map: dict[str, str],
) -> tuple[pd.DataFrame, int]:
    """
    REDCap exports checkbox fields as fieldname___1, fieldname___2, ...
    Expand these to fieldname___choice_label for readability.
    Returns (updated_df, count_of_checkboxes_expanded).
    """
    expanded = 0
    rename: dict[str, str] = {}

    for col in df.columns:
        match = re.match(r"^(.+)___(\w+)$", col)
        if not match:
            continue
        base, code = match.groups()
        choices = choices_map.get(base, {})
        choice_label = choices.get(code, code)
        field_label = label_map.get(base, base)
        rename[col] = f"{field_label} — {choice_label}"
        expanded += 1

    if rename:
        df = df.rename(columns=rename)
    return df, expanded


def _filter_dates(
    df: pd.DataFrame,
    date_col: str,
    date_from: str | None,
    date_to: str | None,
) -> tuple[pd.DataFrame, int]:
    before = len(df)
    dates = pd.to_datetime(df[date_col], errors="coerce")
    mask = pd.Series([True] * len(df), index=df.index)
    if date_from:
        mask &= dates >= pd.Timestamp(date_from)
    if date_to:
        mask &= dates <= pd.Timestamp(date_to)
    df = df[mask].reset_index(drop=True)
    return df, before - len(df)
