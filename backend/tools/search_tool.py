import logging
from config import settings
import httpx
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

logger = logging.getLogger(__name__)

# country name → (Serper gl code, Serper hl code, language name)
# gl = Google country for localized ranking, hl = interface/result language
_COUNTRY_LANG: dict[str, tuple[str, str, str]] = {
    "Egypt": ("eg", "ar", "Arabic"),
    "Saudi Arabia": ("sa", "ar", "Arabic"),
    "United Arab Emirates": ("ae", "ar", "Arabic"),
    "Morocco": ("ma", "ar", "Arabic"),
    "Jordan": ("jo", "ar", "Arabic"),
    "Iraq": ("iq", "ar", "Arabic"),
    "Turkey": ("tr", "tr", "Turkish"),
    "Japan": ("jp", "ja", "Japanese"),
    "China": ("cn", "zh-cn", "Chinese"),
    "South Korea": ("kr", "ko", "Korean"),
    "Thailand": ("th", "th", "Thai"),
    "Vietnam": ("vn", "vi", "Vietnamese"),
    "Indonesia": ("id", "id", "Indonesian"),
    "India": ("in", "hi", "Hindi"),
    "Brazil": ("br", "pt", "Portuguese"),
    "Portugal": ("pt", "pt", "Portuguese"),
    "Spain": ("es", "es", "Spanish"),
    "Mexico": ("mx", "es", "Spanish"),
    "Argentina": ("ar", "es", "Spanish"),
    "Colombia": ("co", "es", "Spanish"),
    "France": ("fr", "fr", "French"),
    "Germany": ("de", "de", "German"),
    "Italy": ("it", "it", "Italian"),
    "Russia": ("ru", "ru", "Russian"),
    "Ukraine": ("ua", "uk", "Ukrainian"),
    "Greece": ("gr", "el", "Greek"),
    "Netherlands": ("nl", "nl", "Dutch"),
    "Poland": ("pl", "pl", "Polish"),
    "Czech Republic": ("cz", "cs", "Czech"),
    "Iran": ("ir", "fa", "Persian"),
    "Pakistan": ("pk", "ur", "Urdu"),
    "Bangladesh": ("bd", "bn", "Bengali"),
}


async def _search_via_serper(query: str, num: int = 5, gl: str = "", hl: str = "") -> list[dict]:
    """Search via Serper API. gl/hl add country/language localisation."""
    if not settings.SERPER_API_KEY:
        return []
    try:
        payload: dict = {"q": query, "num": min(num, 10)}
        if gl:
            payload["gl"] = gl
        if hl:
            payload["hl"] = hl
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            return [
                {"title": r.get("title", ""), "snippet": r.get("snippet", ""), "link": r.get("link", "")}
                for r in response.json().get("organic", [])
            ]
    except Exception as e:
        logger.error(f"Serper search error for '{query}': {e}")
        return []


async def _search(query: str, num: int = 5) -> list[dict]:
    if not settings.ENABLE_WEB_SEARCH:
        return []
    return await _search_via_serper(query, num)


async def search_travel_safety(destination: str) -> list[dict]:
    return await _search(f"{destination} solo female traveler safety 2024")


async def search_hotel_reviews(hotel_name: str, destination: str) -> list[dict]:
    return await _search(f"{hotel_name} {destination} solo female traveler review")


async def search_travel_advisory(destination: str) -> list[dict]:
    return await _search(f"{destination} travel advisory women safety")


async def search_emergency_numbers(country: str, city: str = "") -> list[dict]:
    """Targeted search for OFFICIAL emergency numbers, biased to Wikipedia + .gov sources.
    The safety agent uses these results to extract police/ambulance/fire numbers without guessing.
    """
    if not country:
        return []
    # Wikipedia hosts the canonical "List of emergency telephone numbers" article — bias toward it.
    location = city or country
    query = (
        f"emergency telephone numbers {country} police ambulance fire "
        f"site:en.wikipedia.org OR site:gov OR \"{location}\""
    )
    return await _search(query, num=6)


async def search_recent_incidents(destination: str) -> list[dict]:
    """Recency-biased search for safety incidents AND positive context affecting solo female
    travelers in the past ~30 days. The safety agent extracts dated, sourced events from these.
    Serper's `tbs=qdr:m` parameter restricts results to the past month.
    """
    if not destination or not settings.SERPER_API_KEY or not settings.ENABLE_WEB_SEARCH:
        return []
    query = (
        f"{destination} solo female traveler safety incident OR scam OR harassment OR warning"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": 8, "tbs": "qdr:m"},  # past month
            )
            response.raise_for_status()
            return [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("snippet", ""),
                    "link": r.get("link", ""),
                    "date": r.get("date", ""),  # Serper returns relative dates when available
                }
                for r in response.json().get("organic", [])
            ]
    except Exception as e:
        logger.error(f"Recent-incidents search error for '{destination}': {e}")
        return []


async def search_crisis_directory(country: str, city: str = "") -> list[dict]:
    """Search for women-focused crisis lines, sexual assault hotlines, tourist police,
    and embassy registration info for the destination."""
    if not country:
        return []
    location = city or country
    query = (
        f"{location} women crisis hotline sexual assault helpline tourist police "
        f"OR \"women's helpline\" OR \"violence against women\""
    )
    return await _search(query, num=8)


async def search_travel_safety_local(destination: str, country: str) -> list[dict]:
    """Search for safety info in the destination's primary language.

    Returns empty list if the country uses English or is not in the language map.
    """
    if not settings.ENABLE_WEB_SEARCH or not country:
        return []
    lang_entry = _COUNTRY_LANG.get(country)
    if not lang_entry:
        return []
    gl, hl, language_name = lang_entry

    try:
        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model="gemini-3.1-flash-lite-preview",
            temperature=0,
            max_output_tokens=100,
        )
        prompt = (
            f"Translate ONLY this search query into {language_name}. "
            f"Return the translated query and nothing else:\n"
            f"solo female traveler safety risks {destination} 2024"
        )
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        local_query = (response.content if isinstance(response.content, str) else str(response.content)).strip()
        if not local_query:
            return []
    except Exception as e:
        logger.warning(f"Local query translation failed for {country}: {e}")
        return []

    results = await _search_via_serper(local_query, num=5, gl=gl, hl=hl)
    logger.info(f"Local-language search ({language_name}) for '{destination}': {len(results)} results")
    return results
