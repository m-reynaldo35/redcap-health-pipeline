"""
REDCap API Import — Module 4a
Posts mapped records to REDCap using a standard user API token.
REDCap API docs: https://your-institution/redcap/api/help/
"""
import json
import httpx
from dataclasses import dataclass
from typing import Any


@dataclass
class ImportRecord:
    record_id: str
    fields: dict[str, str]


@dataclass
class RecordImportResult:
    record_id: str
    success: bool
    redcap_response: str
    error: str | None = None


@dataclass
class BatchImportResult:
    batch_id: str
    total: int
    imported: int
    failed: int
    results: list[RecordImportResult]


async def import_records(
    records: list[ImportRecord],
    redcap_url: str,
    token: str,
    batch_id: str,
    overwrite: bool = False,
) -> BatchImportResult:
    """
    Import a batch of records into REDCap via the API.
    REDCap's import endpoint accepts all records in a single POST call.
    Per-record success/failure is inferred from the response count.
    """
    if not records:
        return BatchImportResult(
            batch_id=batch_id, total=0, imported=0, failed=0, results=[]
        )

    data = [{"record_id": r.record_id, **r.fields} for r in records]

    payload = {
        "token": token,
        "content": "record",
        "format": "json",
        "type": "flat",
        "overwriteBehavior": "overwrite" if overwrite else "normal",
        "forceAutoNumber": "false",
        "data": json.dumps(data),
        "returnContent": "count",
        "returnFormat": "json",
    }

    results: list[RecordImportResult] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(redcap_url, data=payload)
            response.raise_for_status()
            body = response.json()

            if "error" in body:
                # REDCap returned an error — mark all records as failed
                for r in records:
                    results.append(RecordImportResult(
                        record_id=r.record_id,
                        success=False,
                        redcap_response=str(body),
                        error=body["error"],
                    ))
                return BatchImportResult(
                    batch_id=batch_id,
                    total=len(records),
                    imported=0,
                    failed=len(records),
                    results=results,
                )

            # REDCap returns {"count": N} on success
            count = int(body.get("count", 0))
            for r in records:
                results.append(RecordImportResult(
                    record_id=r.record_id,
                    success=True,
                    redcap_response=f"Batch imported {count} record(s)",
                ))
            return BatchImportResult(
                batch_id=batch_id,
                total=len(records),
                imported=count,
                failed=max(0, len(records) - count),
                results=results,
            )

    except httpx.TimeoutException:
        err = "REDCap API request timed out"
    except httpx.HTTPStatusError as e:
        err = f"REDCap API HTTP {e.response.status_code}: {e.response.text[:200]}"
    except Exception as e:
        err = f"Unexpected error: {str(e)}"

    for r in records:
        results.append(RecordImportResult(
            record_id=r.record_id,
            success=False,
            redcap_response="",
            error=err,
        ))
    return BatchImportResult(
        batch_id=batch_id,
        total=len(records),
        imported=0,
        failed=len(records),
        results=results,
    )
