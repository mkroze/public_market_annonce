import os

BASE_URL = "https://www.marchespublics.gov.ma"
SEARCH_URL = f"{BASE_URL}/index.php"
PORTAL_URL = f"{BASE_URL}/pmmp/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
}

DB_PATH = "data/tenders.db"

# Cached DCE ZIPs live next to the DB on the persistent /app/data volume so
# users get instant, form-free downloads instead of the slow live handshake.
DCE_CACHE_DIR = "data/dce_cache"
# A warm-all run stops before free disk drops below this, to protect the volume.
DCE_MIN_FREE_BYTES = 500 * 1024 * 1024  # 500 MB
# Hard budget for total cached DCE bytes. Lazy caching evicts oldest to stay
# under this; the warm-all stops when it's reached. Override via env.
# Sized for the 5 GB persistent volume: 4 GB budget leaves ~1 GB headroom, well
# clear of the 500 MB free-disk guard above.
DCE_CACHE_MAX_BYTES = int(os.getenv("DCE_CACHE_MAX_BYTES", str(4 * 1024 * 1024 * 1024)))  # 4 GB
# Per-download jitter in a warm-all run. Concurrency is now the throughput lever
# and downward backoff is the safety mechanism, so this only needs to add mild
# jitter (reduced from 5-7s). A fresh random value in [MIN, MAX] is drawn per
# download. Override via env.
DCE_WARM_DELAY_MIN = float(os.getenv("DCE_WARM_DELAY_MIN", "1"))  # seconds
DCE_WARM_DELAY_MAX = float(os.getenv("DCE_WARM_DELAY_MAX", "2"))  # seconds

# Parallel warm-all with downward-only self-throttling. Start at START_THREADS
# concurrent downloads; NEVER increase. On a portal push-back "flag", pause for
# PAUSE_SECONDS then resume with BACKOFF_STEP fewer threads, down to MIN_THREADS.
# A flag at MIN_THREADS stops the run. All env-overridable.
DCE_WARM_START_THREADS = int(os.getenv("DCE_WARM_START_THREADS", "4"))
DCE_WARM_PAUSE_SECONDS = float(os.getenv("DCE_WARM_PAUSE_SECONDS", "60"))
DCE_WARM_BACKOFF_STEP = int(os.getenv("DCE_WARM_BACKOFF_STEP", "1"))
DCE_WARM_MIN_THREADS = int(os.getenv("DCE_WARM_MIN_THREADS", "1"))

# Hard cap on how many *new* DCE ZIPs a single warm-all run will download.
# The whole ZIP is held in memory per download; capping the batch keeps a run's
# peak RSS bounded so an in-process sweep can't OOM-kill the web worker (which on
# Render restarts the container + fires the startup email). Already-cached
# tenders don't count against the cap — a resumable sweep just picks up the next
# 30 on the next run, so many small runs cover the full catalog safely. 0 = no
# cap (legacy behavior). Override via env.
DCE_WARM_MAX_DOWNLOADS = int(os.getenv("DCE_WARM_MAX_DOWNLOADS", "30"))

# Cleanup of "périmé" (stale) cache folders. A cached DCE is stale once its
# tender is archived, past its deadline, or gone from the catalog (see
# dce_cache._STALE_TENDER_IDS). Orphan files (a ZIP on disk with no matching
# 'ok' row, e.g. left by a crash mid-write) are also pruned. This is enforced by
# the "outdated" clear mode and the periodic janitor.
DCE_CACHE_PRUNE_ORPHANS = os.getenv("DCE_CACHE_PRUNE_ORPHANS", "1").strip().lower() in ("1", "true", "yes", "on")

# DCE extraction pipeline. Recap markdown lives next to the ZIP cache on /app/data.
DCE_CONTEXT_DIR = os.getenv("DCE_CONTEXT_DIR", "data/dce_context")
# n8n webhook the backend calls to enqueue one tender for OCR→redact→extract.
N8N_EXTRACT_WEBHOOK_URL = os.getenv("N8N_EXTRACT_WEBHOOK_URL", "")
# Shared secret the n8n callback must present, and HMAC key for signed ZIP URLs.
DCE_EXTRACTION_SECRET = os.getenv("DCE_EXTRACTION_SECRET", "")
# Signed ZIP-fetch URL lifetime (seconds) handed to the OCR box.
DCE_EXTRACT_SIGNING_TTL = int(os.getenv("DCE_EXTRACT_SIGNING_TTL", "900"))  # 15 min

SECTORS = {
    "1.10": "Terrassements",
    "1.11": "Fondations, injections, parois moulées, sondages et forages",
    "1.12": "Travaux de voiries, chemins et pistes",
    "1.13": "Travaux d'assainissement, d'eau potable et de réseaux divers",
    "1.14": "Construction d'ouvrages d'art",
    "1.15": "Travaux de construction et d'aménagement",
    "1.16": "Travaux d'installation",
    "1.17": "Travaux d'électricité",
    "1.18": "Travaux d'étanchéité, isolation, plomberie et menuiserie",
    "1.19": "Travaux de revêtement, platerie et peinture",
    "1.21": "Travaux hydrauliques, maritimes et fluviaux",
    "1.22": "Aménagement de jardins, d'espaces verts",
    "1.23": "Travaux forestiers",
    "2.7": "Produits alimentaires, élevage, pêche, agriculture",
    "2.8": "Produits pétroliers, carburants, lubrifiants",
    "2.9": "Produits chimiques, nettoyage, insecticides",
    "2.10": "Matières premières, textile, cuir, caoutchouc, plastique",
    "2.11": "Effets d'habillement et accessoires",
    "2.12": "Matériel et articles de sport",
    "2.13": "Objets d'art, articles artistiques",
    "2.14": "Imprimés, produits d'impression, reproduction",
    "2.15": "Équipements et produits médicaux, pharmaceutiques",
    "2.16": "Matériaux de construction, plomberie, quincaillerie",
    "2.17": "Documentation, manuels, fournitures scolaires",
    "2.18": "Matériel informatique, logiciels",
    "2.19": "Matériel, mobilier et fournitures de bureau",
    "2.20": "Matériel et fournitures électriques, électroniques",
    "2.21": "Matériel technique, lutte contre l'incendie",
    "2.22": "Engins de chantier, manutention, levage",
    "2.23": "Matériel de transport, pièces de rechange",
    "2.24": "Matériel de literie, couchage, cuisine, buanderie",
    "2.25": "Location avec option d'achat",
    "3.1": "Études, maîtrise d'oeuvre, ingénierie",
    "3.2": "Informatique, télécommunications",
    "3.3": "Formation, organisation, ressources humaines",
    "3.4": "Restauration, hôtellerie, réception",
    "3.5": "Gardiennage, sécurité, nettoyage",
    "3.6": "Transport, déménagement",
    "3.7": "Location, assurances",
    "3.8": "Maintenance, entretien, réparation",
    "3.9": "Communication, publicité, édition",
    "3.10": "Contrôle, audit, expertise",
}

CATEGORIES = {
    "1": "Travaux",
    "2": "Fournitures",
    "3": "Services",
}
