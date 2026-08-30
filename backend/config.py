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
DCE_CACHE_MAX_BYTES = int(os.getenv("DCE_CACHE_MAX_BYTES", str(1024 * 1024 * 1024)))  # 1 GB

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
