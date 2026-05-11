"""
Stats Exporter — Module 6
Produces analysis-ready outputs from a stripped REDCap DataFrame.

Formats:
  csv   — plain CSV (UTF-8 BOM for Excel compatibility)
  xlsx  — Excel workbook: Data sheet + Summary Statistics sheet
  sav   — SPSS .sav format via pyreadstat
"""
import io
import tempfile
from pathlib import Path

import pandas as pd


class StatsExporter:

    def export(self, df: pd.DataFrame, format: str) -> tuple[bytes, str]:
        """Returns (file_bytes, mime_type)."""
        if format == "csv":
            return self._to_csv(df), "text/csv"
        if format == "xlsx":
            return self._to_excel(df), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if format == "sav":
            return self._to_spss(df), "application/x-spss-sav"
        raise ValueError(f"Unsupported format: {format}")

    # ------------------------------------------------------------------

    @staticmethod
    def _to_csv(df: pd.DataFrame) -> bytes:
        # UTF-8 BOM ensures Excel opens it correctly without encoding issues
        return df.to_csv(index=False).encode("utf-8-sig")

    @staticmethod
    def _to_excel(df: pd.DataFrame) -> bytes:
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Data", index=False)

            # Summary statistics sheet
            numeric = df.select_dtypes(include="number")
            if not numeric.empty:
                summary = numeric.describe().T
                summary.index.name = "Variable"
                summary.to_excel(writer, sheet_name="Summary Statistics")

        return buf.getvalue()

    @staticmethod
    def _to_spss(df: pd.DataFrame) -> bytes:
        try:
            import pyreadstat
        except ImportError:
            raise RuntimeError("pyreadstat is required for SPSS export. Run: pip install pyreadstat")

        # pyreadstat needs a file path; write to temp then read back
        with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as f:
            tmp_path = Path(f.name)

        try:
            # pyreadstat requires numeric or string columns — coerce mixed types
            clean = df.copy()
            for col in clean.columns:
                if clean[col].dtype == object:
                    clean[col] = clean[col].fillna("").astype(str)
                else:
                    clean[col] = pd.to_numeric(clean[col], errors="coerce")

            pyreadstat.write_sav(clean, str(tmp_path))
            return tmp_path.read_bytes()
        finally:
            tmp_path.unlink(missing_ok=True)


# Singleton
exporter = StatsExporter()
