from fastapi import APIRouter, HTTPException, Query
from backend.models.schemas import CatalogUpsert
from backend.services.catalog_store import search_entries, facet_values, upsert_entry, delete_entry
from backend.services.catalog_service import enrich, enriched_entry, coverage_stats

router = APIRouter()


@router.get("")
async def list_catalog(team: str | None = None, tier: str | None = None,
                       lifecycle: str | None = None, q: str | None = Query(None)):
    entries = search_entries(team=team, tier=tier, lifecycle=lifecycle, q=q)
    return {"entries": [enrich(e) for e in entries], "count": len(entries)}


@router.get("/facets")
async def get_facets():
    return facet_values()


@router.get("/stats")
async def get_stats():
    return coverage_stats()


@router.get("/{service}")
async def get_catalog_entry(service: str):
    entry = enriched_entry(service)
    if not entry:
        raise HTTPException(status_code=404, detail="service not in catalog")
    return entry


@router.post("")
async def create_or_update(payload: CatalogUpsert):
    entry = upsert_entry(payload)
    return enrich(entry)


@router.put("/{service}")
async def update_entry(service: str, payload: CatalogUpsert):
    payload.service = service
    entry = upsert_entry(payload)
    return enrich(entry)


@router.delete("/{service}")
async def remove_entry(service: str):
    if not delete_entry(service):
        raise HTTPException(status_code=404, detail="service not in catalog")
    return {"deleted": service}
