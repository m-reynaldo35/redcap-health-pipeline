"""
PDF Inspector — Module 1
Reads a PDF and returns its full structure: text blocks, tables, layout, metadata.
Used during development to understand a hospital's report format before writing extractors.
"""
import pdfplumber
from typing import Any


def inspect_pdf(file_bytes: bytes) -> dict[str, Any]:
    result: dict[str, Any] = {
        "metadata": {},
        "page_count": 0,
        "pages": [],
        "summary": {},
    }

    with pdfplumber.open(file_bytes) as pdf:
        result["metadata"] = _clean_metadata(pdf.metadata or {})
        result["page_count"] = len(pdf.pages)

        total_words = 0
        total_tables = 0

        for page in pdf.pages:
            page_data: dict[str, Any] = {
                "page_num": page.page_number,
                "width": round(page.width, 1),
                "height": round(page.height, 1),
                "text": page.extract_text() or "",
                "tables": [],
                "words": [],
            }

            # Extract tables
            tables = page.extract_tables()
            for table in tables:
                cleaned = [
                    [cell.strip() if cell else "" for cell in row]
                    for row in table
                    if any(cell for cell in row)
                ]
                if cleaned:
                    page_data["tables"].append(cleaned)
                    total_tables += 1

            # Extract individual words with positions (useful for layout analysis)
            words = page.extract_words()
            page_data["words"] = [
                {
                    "text": w["text"],
                    "x0": round(w["x0"], 1),
                    "top": round(w["top"], 1),
                }
                for w in words[:200]  # cap at 200 words per page to keep response manageable
            ]

            total_words += len(words)
            result["pages"].append(page_data)

    result["summary"] = {
        "total_pages": result["page_count"],
        "total_words": total_words,
        "total_tables": total_tables,
        "has_tables": total_tables > 0,
        "likely_machine_readable": total_words > 50,
    }

    return result


def _clean_metadata(meta: dict) -> dict:
    return {
        k: str(v) for k, v in meta.items()
        if v and k in ("Title", "Author", "Subject", "Creator", "Producer", "CreationDate", "ModDate")
    }
