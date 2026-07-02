from fastapi import APIRouter, HTTPException, Query
from backend.services.catalog_store import search_entries, facet_values
from backend.services.catalog_service import enrich, enriched_entry

router = APIRouter()


@router.get("")
async def list_catalog(team: str | None = None, tier: str | None = None,
                       lifecycle: str | None = None, q: str | None = Query(None)):
    entries = search_entries(team=team, tier=tier, lifecycle=lifecycle, q=q)
    return {"entries": [enrich(e) for e in entries], "count": len(entries)}


@router.get("/facets")
async def get_facets():
    return facet_values()


@router.get("/{service}")
async def get_catalog_entry(service: str):
    entry = enriched_entry(service)
    if not entry:
        raise HTTPException(status_code=404, detail="service not in catalog")
    return entry
