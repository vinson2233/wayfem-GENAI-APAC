"""
Seed the Firestore community_tips collection with realistic tips
from women sharing their first-hand travel experiences.

Run from backend/:
    python scripts/seed_community.py

Set GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS (or ADC) before running.
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.community import CommunityTip, TipCategory
from database.firestore import save_community_tip

# ---------------------------------------------------------------------------
# Seed data — authentic, specific, first-hand experiences
# ---------------------------------------------------------------------------

TIPS: list[dict] = [

    # ── Tokyo, Japan ────────────────────────────────────────────────────────
    {"dest": "tokyo_japan", "alias": "AyakoWanderer", "cat": TipCategory.TRANSPORT,
     "tip": "Download the Suica app before you land — it works on every train, bus, and even convenience stores. Avoid the JR Narita Express if you're on a budget; the Keisei Skyliner is faster to Shinjuku and half the price.", "upvotes": 74},
    {"dest": "tokyo_japan", "alias": "SoloSakura_Britt", "cat": TipCategory.ACCOMMODATION,
     "tip": "Stay in Shinjuku or Shibuya for your first visit — both have 24/7 konbini on every corner and it's always busy, which feels safer late at night. Avoid the far east side of Kabukicho when walking back from dinner.", "upvotes": 61},
    {"dest": "tokyo_japan", "alias": "RamenRoamer", "cat": TipCategory.FOOD,
     "tip": "Women-only floors exist in many restaurants in Shinjuku — look for the 女性専用 sign. Ichiran ramen has solo booths with curtains which is genuinely the most comfortable solo meal experience I've had anywhere.", "upvotes": 89},
    {"dest": "tokyo_japan", "alias": "MidnightMetro_Yuki", "cat": TipCategory.NIGHTLIFE,
     "tip": "Last trains run around midnight — know your line's final departure from Shinjuku station or you're paying ¥3,000+ for a taxi. Screenshot the timetable offline. The women-only train cars (pink signs) exist during rush hour and are a relief.", "upvotes": 55},
    {"dest": "tokyo_japan", "alias": "JapanPackerElla", "cat": TipCategory.EMERGENCY,
     "tip": "Police boxes (Koban) are on almost every major corner — staff are helpful and usually have basic English. Save 110 (police) and 119 (ambulance) and know your hotel's address in Japanese to show a taxi driver.", "upvotes": 42},
    {"dest": "tokyo_japan", "alias": "TokyoTanuki", "cat": TipCategory.GENERAL,
     "tip": "The groping (chikan) problem on packed trains is real. Don't hesitate to loudly say 'Chikan!' if it happens — bystanders will help immediately. Using the women-only cars during rush hour eliminates the risk entirely.", "upvotes": 103},
    {"dest": "tokyo_japan", "alias": "OnsenOlive", "cat": TipCategory.GENERAL,
     "tip": "Many onsen still ban visible tattoos — call ahead. Tattoo-friendly ones are listed on Japan Wonder Travel's website. Sento (public baths in neighbourhoods) are generally more relaxed about it.", "upvotes": 38},
    {"dest": "tokyo_japan", "alias": "HarajukuHannah", "cat": TipCategory.ACCOMMODATION,
     "tip": "Female-only capsule hotels in Tokyo are genuinely great — Book and Bed in Shinjuku lets you sleep in a bookshelf pod. The shared bathrooms are spotless and there's a real sense of community among solo women travellers.", "upvotes": 67},

    # ── Paris, France ────────────────────────────────────────────────────────
    {"dest": "paris_france", "alias": "CaféClaireB", "cat": TipCategory.GENERAL,
     "tip": "Eating alone at a Parisian bistro is completely normal and no one will make you feel awkward. Sit at the bar if you want company from the barista — they often chat. Avoid tourist traps on Rue de la Huchette near Notre-Dame.", "upvotes": 58},
    {"dest": "paris_france", "alias": "MetroMadeleine", "cat": TipCategory.TRANSPORT,
     "tip": "Avoid lines 2 and 13 late at night — they run through rougher areas. Line 1 and 14 are automated and always feel safer. Keep your phone in your front pocket on the metro; pickpockets work in pairs and are very fast.", "upvotes": 84},
    {"dest": "paris_france", "alias": "SeineSophie", "cat": TipCategory.NIGHTLIFE,
     "tip": "Montmartre is beautiful but the walk down from Sacré-Cœur after dark can feel uncomfortable with persistent street vendors. Take the funicular and taxi/Uber from the bottom. Le Marais is where I'd actually go at night — lively and much safer.", "upvotes": 71},
    {"dest": "paris_france", "alias": "LouvreLindsay", "cat": TipCategory.ACCOMMODATION,
     "tip": "Stay in the 2nd, 3rd, or 4th arrondissement for the best balance of safety, walkability, and price. The 18th (Montmartre) is fine during the day but I wouldn't stay there alone for a first visit.", "upvotes": 49},
    {"dest": "paris_france", "alias": "BaguetteBrigitte", "cat": TipCategory.FOOD,
     "tip": "The best cheap solo lunch: grab a sandwich from any boulangerie (avoid the tourist-facing ones with English menus on the outside), find a park bench. Jardin du Palais Royal is magical and very safe for solo women picnics.", "upvotes": 93},
    {"dest": "paris_france", "alias": "RiveGaucheRachel", "cat": TipCategory.EMERGENCY,
     "tip": "The 15 emergency number works for everything. Download the SAMU app. The American Hospital in Neuilly speaks English if you need it and won't make you wait as long as public emergency rooms.", "upvotes": 31},
    {"dest": "paris_france", "alias": "VélibValentine", "cat": TipCategory.TRANSPORT,
     "tip": "The Vélib' bike-share is fantastic for daytime and early evening. Cycling along the Seine is genuinely beautiful. The app requires a French phone number — use +33 with your WhatsApp number to register.", "upvotes": 44},

    # ── Bali, Indonesia ──────────────────────────────────────────────────────
    {"dest": "bali_indonesia", "alias": "UbudUma", "cat": TipCategory.TRANSPORT,
     "tip": "Never take an unmetered taxi from the airport — book GoJek or Grab or use the official Blue Bird taxi lane. The price difference is enormous and unofficial drivers can be predatory with foreigners, especially women alone.", "upvotes": 118},
    {"dest": "bali_indonesia", "alias": "TempleTrailTara", "cat": TipCategory.GENERAL,
     "tip": "Pack a sarong in your daypack at all times. Entrance to every temple requires covering your legs, and some vendors sell overpriced ones at the gate. A lightweight scarf doubles as sun protection on motorbike rides.", "upvotes": 76},
    {"dest": "bali_indonesia", "alias": "RiceFieldRoamer", "cat": TipCategory.ACCOMMODATION,
     "tip": "Canggu and Ubud feel the safest for solo women — both have strong expat communities so you'll never feel isolated. Seminyak is fine but louder. Avoid Kuta entirely if you're solo — it attracts a party crowd that can get aggressive.", "upvotes": 85},
    {"dest": "bali_indonesia", "alias": "NasiGorengNora", "cat": TipCategory.FOOD,
     "tip": "Warungs (local food stalls) are safe, delicious, and a third of the price of tourist restaurants. The ones with plastic chairs on the pavement are almost always better than the Instagram cafes. Ask locals where they eat.", "upvotes": 62},
    {"dest": "bali_indonesia", "alias": "SunsetSurfSienna", "cat": TipCategory.NIGHTLIFE,
     "tip": "Seminyak has a fun rooftop bar scene that's generally respectful. Avoid Skygarden in Kuta — it gets very aggressive late. Double Six Beach in Seminyak at sunset is the social sweet spot without the nightclub energy.", "upvotes": 54},
    {"dest": "bali_indonesia", "alias": "YogaRetreater_Jo", "cat": TipCategory.GENERAL,
     "tip": "Bali Belly (traveller's diarrhoea) hits about 30% of visitors. Drink only bottled water, avoid ice in street warungs, and carry Imodium. The best pharmacy is Kimia Farma — branches everywhere and staff speak English.", "upvotes": 91},
    {"dest": "bali_indonesia", "alias": "MoonRiseMia", "cat": TipCategory.EMERGENCY,
     "tip": "BIMC Hospital in Kuta is the best English-speaking clinic for tourists. Keep travel insurance details on your phone — many hospitals here ask for payment upfront and won't wait for insurance to process.", "upvotes": 47},

    # ── Istanbul, Turkey ─────────────────────────────────────────────────────
    {"dest": "istanbul_turkey", "alias": "BosphorusBelen", "cat": TipCategory.TRANSPORT,
     "tip": "The Istanbulkart (metro card) is essential — buy one at the airport kiosk immediately. The tram T1 line connects most tourist sites and feels very safe with CCTV everywhere. Avoid unmetered taxis — use BiTaksi app instead.", "upvotes": 79},
    {"dest": "istanbul_turkey", "alias": "GrandBazaarGrace", "cat": TipCategory.GENERAL,
     "tip": "Vendors in the Grand Bazaar will be persistent and flirtatious — a firm 'hayır' (no) and walking on is effective. Don't feel obligated to enter shops or have tea with vendors, no matter how friendly. It always leads to a hard sell.", "upvotes": 95},
    {"dest": "istanbul_turkey", "alias": "HammamHilary", "cat": TipCategory.ACCOMMODATION,
     "tip": "Stay in Sultanahmet or Beyoğlu for your first visit. Karaköy is trendy and very walkable at night. The Fatih neighbourhood is more conservative — dress modestly there and expect less English spoken.", "upvotes": 53},
    {"dest": "istanbul_turkey", "alias": "TurkishTeaTanya", "cat": TipCategory.FOOD,
     "tip": "Eat çorba (soup) for breakfast like locals do — cheap, filling, perfect. Simit (sesame bread ring) from street carts is 7 lira and better than any hotel breakfast. The Karaköy fish sandwiches at the bridge are genuinely delicious and 100% safe.", "upvotes": 68},
    {"dest": "istanbul_turkey", "alias": "SuleimanSunset", "cat": TipCategory.NIGHTLIFE,
     "tip": "Beyoğlu and Cihangir are the best neighbourhoods for evening walks and bars — mixed, cosmopolitan crowds. Avoid the backstreets of Taksim late at night. The tram stops running around midnight so know your Uber route back.", "upvotes": 57},
    {"dest": "istanbul_turkey", "alias": "MosqueMiranda", "cat": TipCategory.GENERAL,
     "tip": "Cover your hair when entering mosques — a scarf tied loosely is fine. Most mosques have loaner scarves at the entrance but they're scratchy. Keep your shoulders and knees covered in religious areas as a general rule.", "upvotes": 44},
    {"dest": "istanbul_turkey", "alias": "CatLadyIstanbul", "cat": TipCategory.EMERGENCY,
     "tip": "Istanbul has thousands of free-roaming cats that locals care for — they're harmless and charming. Emergency number is 112. Acıbadem Hospital (multiple locations) has excellent English-speaking staff.", "upvotes": 36},

    # ── Cairo, Egypt ─────────────────────────────────────────────────────────
    {"dest": "cairo_egypt", "alias": "NileNavigatorNadia", "cat": TipCategory.TRANSPORT,
     "tip": "Use the women-only carriages on the Cairo Metro (marked with a pink sign at the front of every train) — they're significantly more comfortable for solo travel. Uber works well in Cairo and is safer than hailing street taxis.", "upvotes": 124},
    {"dest": "cairo_egypt", "alias": "PyramidPilgrimPriya", "cat": TipCategory.GENERAL,
     "tip": "Dress conservatively throughout Cairo — loose trousers and a long-sleeved top minimises street harassment significantly. A simple 'la shukran' (no thank you) said firmly without making eye contact works better than any other response.", "upvotes": 107},
    {"dest": "cairo_egypt", "alias": "KhanElKhaliliKara", "cat": TipCategory.FOOD,
     "tip": "Koshari (rice, lentils, tomato sauce) from a street shop is one of the best meals in Egypt — less than 20 EGP and completely safe to eat. Koshary El Tahrir is the most famous. Avoid raw salads and tap water.", "upvotes": 73},
    {"dest": "cairo_egypt", "alias": "ZamalekZara", "cat": TipCategory.ACCOMMODATION,
     "tip": "Stay in Zamalek (Nile island) or Maadi — both are quieter, more expat-friendly, and noticeably less harassing to walk around. Downtown Cairo is more chaotic but has interesting boutique hotels if you want to be central.", "upvotes": 88},
    {"dest": "cairo_egypt", "alias": "SooqSamira", "cat": TipCategory.GENERAL,
     "tip": "Having a local contact (even an Airbnb host) who you can message if anything goes wrong makes a big psychological difference. Join the Cairo expats Facebook group before you arrive — women in there share current safety situations.", "upvotes": 65},
    {"dest": "cairo_egypt", "alias": "DesertDawnDiana", "cat": TipCategory.EMERGENCY,
     "tip": "The tourist police (in white uniforms) are present near all major sites and are generally helpful. Keep the number of your country's embassy on your phone. As-Salam International Hospital in Mohandiseen has English-speaking doctors.", "upvotes": 52},
    {"dest": "cairo_egypt", "alias": "FalafelFreya", "cat": TipCategory.NIGHTLIFE,
     "tip": "Evening Nile felucca rides are beautiful and feel safe if you book through your hotel. Don't accept offers from strangers on the Corniche. The rooftop bars in Zamalek are where expats congregate and are very welcoming to solo women.", "upvotes": 41},

    # ── Rome, Italy ──────────────────────────────────────────────────────────
    {"dest": "rome_italy", "alias": "TrastevereTeresa", "cat": TipCategory.ACCOMMODATION,
     "tip": "Trastevere is the best neighbourhood for solo women — walkable, lively until midnight, genuine Roman atmosphere. Stay near Campo de' Fiori or Testaccio for similar vibes. The Termini station area is fine for transit but I wouldn't stay there.", "upvotes": 81},
    {"dest": "rome_italy", "alias": "GelatiGloria", "cat": TipCategory.FOOD,
     "tip": "Sit-down gelato with a service charge near tourist sites can cost €8 — walk two streets away and pay €2. Giolitti near the Pantheon is legit. Any place where you see locals eating in line is the right choice.", "upvotes": 69},
    {"dest": "rome_italy", "alias": "ColosseoClara", "cat": TipCategory.TRANSPORT,
     "tip": "Rome's bus system is confusing but the 40 and 64 express buses are pickpocket paradise — keep bags in front and don't use your phone. The Metro has only 3 lines so most sights are walkable. Citymapper works perfectly in Rome.", "upvotes": 56},
    {"dest": "rome_italy", "alias": "PiazzaPaolina", "cat": TipCategory.GENERAL,
     "tip": "The catcalling from men outside the Termini area and near tourist sites is frequent. Headphones in, sunglasses on, purposeful walk — that combination alone cuts about 80% of it. Responding in any way only encourages more.", "upvotes": 74},
    {"dest": "rome_italy", "alias": "VaticanVera", "cat": TipCategory.GENERAL,
     "tip": "Book the Vatican Museums online at least a week ahead — the queue without a ticket is 3+ hours in summer. Also: you must cover shoulders and knees to enter St Peter's Basilica. Security turns back tourists at the door.", "upvotes": 88},
    {"dest": "rome_italy", "alias": "AperitivoAlessandra", "cat": TipCategory.NIGHTLIFE,
     "tip": "Aperitivo hour (6–9pm) in Pigneto or Testaccio is one of Rome's best social experiences — buy a €7 drink and get a full plate of food included. Far more welcoming to solo women than the tourist bars near the Trevi Fountain.", "upvotes": 63},

    # ── Barcelona, Spain ─────────────────────────────────────────────────────
    {"dest": "barcelona_spain", "alias": "GothicBarriBeatriz", "cat": TipCategory.TRANSPORT,
     "tip": "Las Ramblas is pickpocket central — every solo traveller I know has either been targeted or knows someone who was. Keep your bag in front, phone in a front pocket, and don't stop for street performers or people who approach you.", "upvotes": 132},
    {"dest": "barcelona_spain", "alias": "SagradaFamiliaStella", "cat": TipCategory.ACCOMMODATION,
     "tip": "Eixample (especially the Esquerra de l'Eixample or 'Gayxample') is the safest and most welcoming area for solo women — wide streets, 24/7 activity, great transport links. Barceloneta (the beach area) is fine during the day but gets rowdy at night.", "upvotes": 77},
    {"dest": "barcelona_spain", "alias": "PinxosPaula", "cat": TipCategory.FOOD,
     "tip": "Eat lunch as your main meal — most restaurants offer a menú del día with 3 courses, wine, and bread for €12-15, the same dishes that cost €30+ at dinner. Boqueria market is gorgeous but overpriced; the market in Gràcia is where locals shop.", "upvotes": 91},
    {"dest": "barcelona_spain", "alias": "NightBusMaria", "cat": TipCategory.NIGHTLIFE,
     "tip": "Barcelona nights start late — bars fill up after midnight, clubs after 2am. The TMB Nitbus runs all night and is safe and reliable. Taxis from the official rank (not street hails) are always my last resort option after 3am.", "upvotes": 58},
    {"dest": "barcelona_spain", "alias": "MontjuicMercedes", "cat": TipCategory.GENERAL,
     "tip": "The beach at Barceloneta has a real bag-theft problem — people specifically target women who put their bag down while swimming. Never leave belongings unattended. Lockers at the beach club are worth the €3.", "upvotes": 86},
    {"dest": "barcelona_spain", "alias": "Vermouth_Valeria", "cat": TipCategory.FOOD,
     "tip": "Sunday vermouth culture (vermut) is one of Barcelona's best kept secrets for solo travellers — any bar doing it will be full of friendly locals and it's totally normal to strike up conversation. Try Bar Calders in Sant Antoni.", "upvotes": 49},

    # ── Bangkok, Thailand ────────────────────────────────────────────────────
    {"dest": "bangkok_thailand", "alias": "TukTukTamara", "cat": TipCategory.TRANSPORT,
     "tip": "Never take a tuk-tuk to a temple a driver 'recommends' — it's a gem scam without exception. Use the BTS Skytrain for almost everything; it's fast, cheap, and air-conditioned. Grab app for any taxi needs.", "upvotes": 109},
    {"dest": "bangkok_thailand", "alias": "WatWanderer_Wendy", "cat": TipCategory.GENERAL,
     "tip": "Thai women are incredibly friendly and will look out for you if you're lost or confused — don't hesitate to ask a woman for directions or help. The 7-Eleven is a genuine community hub and safe place if you feel followed.", "upvotes": 76},
    {"dest": "bangkok_thailand", "alias": "SilomSamantha", "cat": TipCategory.ACCOMMODATION,
     "tip": "Silom and Sukhumvit Soi 11-15 are good bases for solo women — international, safe, good transport. Khao San Road is fun for one night but noisy and chaotic for longer stays. The Ari neighbourhood is where I'd live if I moved here.", "upvotes": 64},
    {"dest": "bangkok_thailand", "alias": "PadThaiPenny", "cat": TipCategory.FOOD,
     "tip": "The best pad thai in Bangkok is never at a sit-down tourist restaurant — it's at a cart on the street corner. Tip Samai near Khao San Road is the famous one but worth the queue. Street food hygiene is generally excellent here.", "upvotes": 87},
    {"dest": "bangkok_thailand", "alias": "IslandHopperIvy", "cat": TipCategory.EMERGENCY,
     "tip": "Bumrungrad International Hospital in Sukhumvit is world-class and English-speaking — you'll pay Western prices but the care is exceptional. For non-emergencies, any pharmacy with a green cross will have English-speaking staff.", "upvotes": 55},
    {"dest": "bangkok_thailand", "alias": "NightMarketNina", "cat": TipCategory.NIGHTLIFE,
     "tip": "The Asiatique riverside night market is a lovely safe evening — outdoor, well-lit, good food, Ferris wheel. Thonglor and Ekkamai are the local hip bar areas: fewer tourists, way better music, and people leave you alone.", "upvotes": 71},

    # ── Amsterdam, Netherlands ───────────────────────────────────────────────
    {"dest": "amsterdam_netherlands", "alias": "CanalCyclistCara", "cat": TipCategory.TRANSPORT,
     "tip": "Rent a bike within your first hour — it's the only way to feel like you belong. Stay out of the clearly marked cycling lanes as a pedestrian (locals will not slow down). The OV-chipkaart works on all trams and metro if cycling isn't for you.", "upvotes": 83},
    {"dest": "amsterdam_netherlands", "alias": "JordaanJessica", "cat": TipCategory.ACCOMMODATION,
     "tip": "Stay in the Jordaan or De Pijp — both are residential, quiet after 10pm, and incredibly walkable. The Red Light District area hotels are cheap for a reason: it's loud until 4am and uncomfortable to walk alone late at night.", "upvotes": 91},
    {"dest": "amsterdam_netherlands", "alias": "MuseumQuarterMae", "cat": TipCategory.GENERAL,
     "tip": "Amsterdam is one of the safest European cities for solo women — I've walked home at 1am many times without concern. The main risks are bikes (they're silent and fast) and pickpockets on the tram around Centraal Station.", "upvotes": 67},
    {"dest": "amsterdam_netherlands", "alias": "StroopwafelSusan", "cat": TipCategory.FOOD,
     "tip": "The best stroopwafels are from the Albert Cuyp Market in De Pijp — fresh off the iron, still warm. Never buy them pre-packaged. The market itself is a fantastic and very safe place to spend a solo morning.", "upvotes": 55},
    {"dest": "amsterdam_netherlands", "alias": "LeidsepleinLara", "cat": TipCategory.NIGHTLIFE,
     "tip": "Leidseplein is lively and fun but touristy. For actual local nightlife, try the Bitterzoet on Spuistraat or bars in the Jordaan. Coffee shops are part of the culture — if you're curious, the ones with 'I Amsterdam' branding are tourist traps.", "upvotes": 48},

    # ── New York City, USA ───────────────────────────────────────────────────
    {"dest": "new_york_usa", "alias": "SubwayStormSylvia", "cat": TipCategory.TRANSPORT,
     "tip": "The subway is safe but follow these rules: stand near the booth when waiting, ride in the middle cars (closest to the conductor at off-peak hours), and use the Citizen app to check real-time incidents in your area. Avoid empty carriages late at night.", "upvotes": 97},
    {"dest": "new_york_usa", "alias": "BrooklynBoundBianca", "cat": TipCategory.ACCOMMODATION,
     "tip": "Brooklyn (Park Slope, Williamsburg, Carroll Gardens) gives you more space and neighbourhood feel for half the Manhattan price. The L, F, and 2/3 trains are all reliable. Midtown Manhattan hotels are convenient but soulless.", "upvotes": 72},
    {"dest": "new_york_usa", "alias": "DumplingDistrictDeb", "cat": TipCategory.FOOD,
     "tip": "The absolute best cheap solo eat: Joe's Pizza slice in the Village (€3), Xi'an Famous Foods hand-pulled noodles in the East Village (€10), and Vanessa's Dumplings in Chinatown (€6 gets you 8 fried dumplings). All counter service, all alone-friendly.", "upvotes": 104},
    {"dest": "new_york_usa", "alias": "CentralParkCassie", "cat": TipCategory.GENERAL,
     "tip": "Central Park is completely safe during daylight — I run there alone every morning. After dark, stick to the well-lit paths and avoid the wooded areas north of 100th Street. The park is surprisingly empty north of 96th Street even in daylight.", "upvotes": 61},
    {"dest": "new_york_usa", "alias": "WilliamsburgWren", "cat": TipCategory.NIGHTLIFE,
     "tip": "New York nightlife is extremely women-friendly — bouncers are used to solo women and most bars are welcoming. East Village and Williamsburg are the best areas. The subway home after midnight is fine; just use the tip above and sit near others.", "upvotes": 53},
    {"dest": "new_york_usa", "alias": "HighLinHannah", "cat": TipCategory.GENERAL,
     "tip": "The High Line (elevated park on the West Side) is one of the most pleasant solo woman experiences in NYC — always busy, great views, free. The Whitney Museum at the south end has a fantastic café if you want to sit alone with a book.", "upvotes": 78},
]


def _random_date() -> datetime:
    """Return a random datetime in the past 18 months."""
    days_ago = random.randint(1, 540)
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


async def seed() -> None:
    print(f"Seeding {len(TIPS)} community tips across {len({t['dest'] for t in TIPS})} destinations…\n")
    success, fail = 0, 0
    for t in TIPS:
        tip = CommunityTip(
            destination_id=t["dest"],
            author_alias=t["alias"],
            tip=t["tip"],
            category=t["cat"],
            upvotes=t["upvotes"],
            created_at=_random_date(),
        )
        try:
            await save_community_tip(tip)
            print(f"  ✓  [{t['dest']}] {t['alias']}")
            success += 1
        except Exception as e:
            print(f"  ✗  [{t['dest']}] {t['alias']} — {e}")
            fail += 1

    print(f"\nDone. {success} saved · {fail} failed.")


if __name__ == "__main__":
    asyncio.run(seed())
