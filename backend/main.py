from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from database import init_db, get_db
from scraper import scrape_all_sectors, scrape_homepage_counts, scrape_tender_detail, download_dce
from config import SECTORS, CATEGORIES


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Marchés Publics Maroc API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/tenders")
async def list_tenders(
    q: str = Query("", description="Keyword search"),
    category: str = Query("", description="Travaux, Fournitures, Services"),
    sector: str = Query("", description="Sector code like 1.12"),
    entity: str = Query("", description="Entity name filter"),
    location: str = Query("", description="Location / province filter"),
    status: str = Query("", description="en_cours, cloture"),
    sort: str = Query("deadline", description="Sort field"),
    order: str = Query("asc", description="asc or desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    db = await get_db()
    conditions = []
    params = []

    if q:
        conditions.append("(title LIKE ? OR reference LIKE ? OR entity LIKE ?)")
        params.extend([f"%{q}%"] * 3)
    if category:
        conditions.append("category = ?")
        params.append(category)
    if sector:
        conditions.append("sector_code = ?")
        params.append(sector)
    if entity:
        conditions.append("entity LIKE ?")
        params.append(f"%{entity}%")
    if location:
        conditions.append("location LIKE ?")
        params.append(f"%{location}%")
    if status:
        conditions.append("status = ?")
        params.append(status)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    allowed_sort = {"deadline", "publication_date", "title", "entity", "location", "scraped_at"}
    sort_col = sort if sort in allowed_sort else "deadline"
    sort_dir = "DESC" if order.lower() == "desc" else "ASC"

    count_row = await db.execute(f"SELECT COUNT(*) as total FROM tenders {where}", params)
    total = (await count_row.fetchone())[0]

    offset = (page - 1) * per_page
    query = f"""
        SELECT * FROM tenders {where}
        ORDER BY {sort_col} {sort_dir}
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(query, params + [per_page, offset])
    rows = await cursor.fetchall()
    await db.close()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "data": [dict(r) for r in rows],
    }


@app.get("/api/tenders/{tender_id}")
async def get_tender(tender_id: str):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM tenders WHERE id = ?", (tender_id,))
    row = await cursor.fetchone()

    if not row:
        await db.close()
        return {"error": "Not found"}, 404

    result = dict(row)

    # Check if we already have details
    det_cursor = await db.execute(
        "SELECT * FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    detail = await det_cursor.fetchone()

    if not detail and result.get("detail_url"):
        # Scrape detail on demand
        scraped = await scrape_tender_detail(result["detail_url"])
        if scraped:
            cols = [
                "tender_id", "objet", "acheteur", "annonce_type", "procedure",
                "categorie", "allotissement", "lieu_execution", "estimation",
                "domaines", "adresse_retrait", "adresse_depot", "lieu_ouverture",
                "caution_provisoire", "qualifications", "agrements", "variante",
                "reunion", "visite_lieux", "contact", "documents_url", "dce_url",
                "avis_url", "reserved_pme", "prix_plans",
            ]
            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols)
            values = [tender_id] + [scraped.get(c, "") for c in cols[1:]]
            await db.execute(
                f"INSERT OR REPLACE INTO tender_details ({col_names}) VALUES ({placeholders})",
                values,
            )
            await db.commit()
            detail = scraped

    await db.close()

    if detail:
        result["details"] = dict(detail) if not isinstance(detail, dict) else detail
    return result


@app.get("/api/overview")
async def overview():
    """Live counts from the portal homepage."""
    counts = await scrape_homepage_counts()
    total = sum(c["count"] for c in counts)
    return {"total_active": total, "sectors": counts}


@app.get("/api/stats")
async def stats():
    db = await get_db()

    total = (await (await db.execute("SELECT COUNT(*) FROM tenders")).fetchone())[0]

    cat_cursor = await db.execute(
        "SELECT category, COUNT(*) as count FROM tenders GROUP BY category ORDER BY count DESC"
    )
    by_category = [dict(r) for r in await cat_cursor.fetchall()]

    sector_cursor = await db.execute(
        """SELECT sector_code, sector_name, category, COUNT(*) as count
           FROM tenders GROUP BY sector_code ORDER BY count DESC LIMIT 20"""
    )
    top_sectors = [dict(r) for r in await sector_cursor.fetchall()]

    entity_cursor = await db.execute(
        "SELECT entity, COUNT(*) as count FROM tenders GROUP BY entity ORDER BY count DESC LIMIT 20"
    )
    top_entities = [dict(r) for r in await entity_cursor.fetchall()]

    await db.close()

    return {
        "total": total,
        "by_category": by_category,
        "top_sectors": top_sectors,
        "top_entities": top_entities,
    }


@app.get("/api/filters")
async def get_filters():
    db = await get_db()

    entities = await db.execute(
        "SELECT DISTINCT entity FROM tenders WHERE entity != '' ORDER BY entity"
    )
    entity_list = [r[0] for r in await entities.fetchall()]

    sectors = await db.execute(
        "SELECT DISTINCT sector_code, sector_name FROM tenders ORDER BY sector_code"
    )
    sector_list = [{"code": r[0], "name": r[1]} for r in await sectors.fetchall()]

    locations = await db.execute(
        "SELECT DISTINCT location FROM tenders WHERE location != '' ORDER BY location"
    )
    location_list = [r[0] for r in await locations.fetchall()]

    await db.close()

    return {
        "categories": [{"code": k, "name": v} for k, v in CATEGORIES.items()],
        "sectors": sector_list,
        "entities": entity_list,
        "locations": location_list,
    }


@app.get("/api/tenders/{tender_id}/dce")
async def download_tender_dce(tender_id: str):
    """Download the DCE ZIP for a tender by filling the form automatically."""
    db = await get_db()

    # Get the DCE URL from tender_details
    det_cursor = await db.execute(
        "SELECT dce_url FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    detail = await det_cursor.fetchone()
    await db.close()

    dce_url = detail["dce_url"] if detail else ""
    if not dce_url:
        return Response(content='{"error": "No DCE URL for this tender"}', status_code=404,
                        media_type="application/json")

    result = await download_dce(dce_url)
    if not result:
        return Response(content='{"error": "Failed to download DCE"}', status_code=502,
                        media_type="application/json")

    file_bytes, filename = result
    return Response(
        content=file_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/scrape")
async def trigger_scrape():
    """Manually trigger a full scrape."""
    result = await scrape_all_sectors()
    return {"status": "done", **result}


@app.get("/api/scrape/status")
async def scrape_status():
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM scrape_log ORDER BY id DESC LIMIT 5"
    )
    logs = [dict(r) for r in await cursor.fetchall()]
    await db.close()
    return {"logs": logs}
