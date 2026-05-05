from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, json, re, logging, uuid, httpx, requests, zipfile, io, csv
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

load_dotenv()

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
NEWS_API_KEY = os.environ.get('NEWS_API_KEY')

app = FastAPI(title="Stock Advisor AI India")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Holding(BaseModel):
    symbol: str
    qty: int
    buy_price: float

class PortfolioRequest(BaseModel):
    holdings: List[Holding]

class StockPickRequest(BaseModel):
    symbol: Optional[str] = None

class PortfolioPlanRequest(BaseModel):
    capital: float = 25000
    risk_appetite: str = "conservative"

EXPERT_PERSONA = """You are a 25-year veteran Indian stock market expert specializing in NSE/BSE listed stocks. You are extremely conservative, focused on capital protection FIRST. You only suggest DELIVERY-based SWING trades (3-15 days holding).
Strict rules:

- NEVER recommend penny stocks (price < Rs50) or stocks with market cap < Rs5000 cr.
- Only suggest fundamentally strong large-cap or quality mid-cap stocks (Nifty 500 universe).
- Always prioritize capital safety over high returns.
- Consider broker charges (~0.5% round-trip).
- Available capital is Rs25,000 - suggest phased entries (max 30-40% per single trade).
- Risk-reward minimum 1:1.5. Stop loss must be tight (3-5% below entry).
  You ALWAYS respond in pure valid JSON ONLY - no markdown, no code fences, no explanation outside JSON."""

# ── BSE Bhavcopy Price Cache ──────────────────────────────────────────────────

_bhavcopy_cache: dict = {}  # symbol -> close price, loaded once per day

def _load_bhavcopy() -> dict:
    """Download BSE bhavcopy CSV for today (or yesterday) and return symbol->price dict."""
    from datetime import datetime, timedelta, timezone
    IST = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(IST)

    # Try today first, then go back up to 5 days (weekends/holidays)
    for days_back in range(6):
        dt = now - timedelta(days=days_back)
        # Skip future date (before 6 PM IST bhavcopy is yesterday's)
        if days_back == 0 and now.hour < 18:
            dt = now - timedelta(days=1)

        dd = dt.strftime("%d")
        mm = dt.strftime("%m")
        yy = dt.strftime("%y")
        url = f"https://www.bseindia.com/download/BhavCopy/Equity/EQ{dd}{mm}{yy}_CSV.ZIP"

        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 200 and len(r.content) > 1000:
                z = zipfile.ZipFile(io.BytesIO(r.content))
                csv_name = z.namelist()[0]
                csv_data = z.read(csv_name).decode("utf-8")
                reader = csv.DictReader(io.StringIO(csv_data))
                prices = {}
                for row in reader:
                    sym = row.get("SYMBOL", "").strip().upper()
                    close = row.get("CLOSE", "") or row.get("close", "")
                    try:
                        if sym and close:
                            prices[sym] = round(float(close), 2)
                    except ValueError:
                        pass
                if prices:
                    logger.info(f"Loaded BSE bhavcopy for {dt.date()}: {len(prices)} symbols")
                    return prices
        except Exception as e:
            logger.warning(f"BSE bhavcopy fetch failed for {dt.date()}: {e}")

    return {}

def _get_bhavcopy() -> dict:
    """Return today's bhavcopy, loading once and caching in memory."""
    global _bhavcopy_cache
    if not _bhavcopy_cache:
        _bhavcopy_cache = _load_bhavcopy()
    return _bhavcopy_cache

def get_live_price(symbol: str):
    """Fetch previous-day close from BSE bhavcopy (free, no auth)."""
    try:
        prices = _get_bhavcopy()
        price = prices.get(symbol.upper().strip())
        if price:
            return price
    except Exception as e:
        logger.warning(f"Bhavcopy price lookup failed for {symbol}: {e}")
    return None

def get_live_nifty():
    """Fetch Nifty 50 from BSE bhavcopy index data."""
    try:
        from datetime import datetime, timedelta, timezone
        IST = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(IST)
        for days_back in range(6):
            dt = now - timedelta(days=days_back)
            if days_back == 0 and now.hour < 18:
                dt = now - timedelta(days=1)
            dd = dt.strftime("%d")
            mm = dt.strftime("%m")
            yy = dt.strftime("%y")
            url = f"https://www.bseindia.com/download/BhavCopy/Equity/IND_CLOSE_ALL_{dd}{mm}{yy}.CSV"
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(url, headers=headers, timeout=15)
            if r.status_code == 200 and len(r.content) > 100:
                reader = csv.DictReader(io.StringIO(r.content.decode("utf-8")))
                for row in reader:
                    name = row.get("IndicesName", "") or row.get("Index Name", "")
                    if "NIFTY 50" in name.upper() or "NIFTY50" in name.upper():
                        close = row.get("Closingindex", "") or row.get("Close", "")
                        if close:
                            return round(float(close), 2)
    except Exception as e:
        logger.warning(f"BSE Nifty fetch failed: {e}")
    return None

def get_market_news():
    """Fetch today's Indian market news from NewsAPI."""
    if not NEWS_API_KEY:
        return []
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": "NSE BSE Nifty Sensex Indian stock market",
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 5,
            "apiKey": NEWS_API_KEY
        }
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            articles = response.json().get("articles", [])
            news = []
            for a in articles[:5]:
                news.append(f"- {a['title']}")
            return news
    except Exception as e:
        logger.warning(f"News fetch failed: {e}")
    return []

def extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^`(?:json)?\s*", "", text)
    text = re.sub(r"\s*`$", "", text)
    m = re.search(r"[{[].*[}]]", text, re.DOTALL)
    if m:
        text = m.group(0)
    return json.loads(text)

async def call_llm(session_id: str, prompt: str) -> dict:
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set.")
    full_prompt = f"{EXPERT_PERSONA}\n\n{prompt}"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": full_prompt}],
        "temperature": 0.7,
        "max_tokens": 2048
    }
    async with httpx.AsyncClient(timeout=60.0) as http:
        response = await http.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq error: {response.status_code}")
    data = response.json()
    try:
        raw_text = data["choices"][0]["message"]["content"]
        return extract_json(raw_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail="AI returned invalid format. Retry.")

@api_router.get("/")
async def root():
    return {"app": "Stock Advisor AI India", "status": "ok"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "llm_configured": bool(GROQ_API_KEY)}

@api_router.post("/today-plan")
async def today_plan(force: bool = False):
    now = datetime.now(timezone.utc)
    cache_key = now.strftime("%Y-%m-%d")
    if not force:
        cached = await db.today_plan_cache.find_one({"date": cache_key}, {"_id": 0})
        if cached:
            ts = datetime.fromisoformat(cached["ts"])
            if (now - ts) < timedelta(minutes=30):
                return cached["data"]

    today_str = now.strftime("%A, %d %B %Y")

    nifty = get_live_nifty()
    news = get_market_news()

    nifty_str = f"Current live Nifty 50 level: {nifty}" if nifty else "Nifty level unavailable"
    news_str = "\n".join(news) if news else "No news available"

    prompt = f"""Today is {today_str}.

LIVE MARKET DATA:
{nifty_str}

TODAY'S LATEST NEWS:
{news_str}

Using the above REAL live data, generate a swing-trader's market plan for Indian retail investors with Rs25,000 capital.

Respond as a single JSON object:
{{
"market_mood": "Bullish|Cautiously Bullish|Neutral|Cautiously Bearish|Bearish",
"mood_reason": "1 short sentence based on real news above max 15 words",
"nifty_trend": "Uptrend|Sideways|Downtrend",
"nifty_note": "1 short sentence mentioning actual Nifty level from live data",
"buy_today": [
{{"symbol": "TICKER", "name": "Company", "reason": "1 line based on news", "buy_range": "RsX-RsY"}},
{{"symbol": "TICKER", "name": "Company", "reason": "1 line based on news", "buy_range": "RsX-RsY"}},
{{"symbol": "TICKER", "name": "Company", "reason": "1 line based on news", "buy_range": "RsX-RsY"}}
],
"hold": [
{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}},
{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}
],
"sell": [
{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}
],
"avoid_today": [
{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}},
{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}
],
"capital_strategy": "1-2 sentences on phased deployment of Rs25k today."
}}"""

    data = await call_llm(f"today-plan-{cache_key}", prompt)
    data["generated_at"] = now.isoformat()
    data["nifty_live"] = nifty
    data["news_count"] = len(news)
    await db.today_plan_cache.update_one(
        {"date": cache_key},
        {"$set": {"date": cache_key, "ts": now.isoformat(), "data": data}},
        upsert=True,
    )
    return data

@api_router.post("/stock-pick")
async def stock_pick(req: StockPickRequest):
    capital = 25000
    live_price = None
    if req.symbol:
        live_price = get_live_price(req.symbol)

    price_info = f"Current live NSE price: Rs{live_price}" if live_price else "Use your best estimate for current price"
    target_clause = f"the stock {req.symbol}" if req.symbol else "ONE high-conviction Indian large/mid-cap stock"

    news = get_market_news()
    news_str = "\n".join(news) if news else "No news available"

    prompt = f"""Generate a complete delivery swing-trade recommendation for {target_clause}.

{price_info}

LATEST NEWS:
{news_str}

Capital for this trade: max 35% of Rs{capital} = Rs{int(capital * 0.35)}.

Respond as JSON:
{{
"symbol": "TICKER",
"name": "Full Company Name",
"sector": "Sector",
"current_price": 1234.5,
"buy_range_low": 1220.0,
"buy_range_high": 1240.0,
"qty": 7,
"stop_loss": 1180.0,
"target_1": 1290.0,
"target_2": 1340.0,
"expected_days": 7,
"risk_score": 3,
"risk_label": "Low|Medium|High",
"charges_estimate": 65.0,
"net_profit_t1": 420.0,
"net_profit_t2": 765.0,
"why_selected": "2-3 sentences based on real news and live price.",
"key_risks": "1 sentence."
}}"""

    sid = req.symbol or "auto"
    data = await call_llm(f"pick-{sid}-{datetime.now().strftime('%Y%m%d%H')}", prompt)
    if live_price:
        data["current_price"] = live_price
        data["price_source"] = "prev_close"
    else:
        data["price_source"] = "ai_estimate"
    return data

@api_router.post("/portfolio-plan")
async def portfolio_plan(req: PortfolioPlanRequest):
    news = get_market_news()
    news_str = "\n".join(news) if news else "No news available"
    nifty = get_live_nifty()
    nifty_str = f"Current live Nifty 50: {nifty}" if nifty else ""

    prompt = f"""Build a swing-trade plan for Rs{int(req.capital)} capital. Risk: {req.risk_appetite}.

{nifty_str}

LATEST NEWS:
{news_str}

Pick 3-4 NSE stocks based on real news above. Respond as JSON:
{{
"total_capital": {int(req.capital)},
"deployed": 22500,
"reserve": 2500,
"reserve_reason": "1 line",
"strategy_note": "1-2 sentences based on real market conditions",
"picks": [
{{
"symbol": "TICKER",
"name": "Company",
"sector": "Sector",
"allocation": 8000,
"current_price": 1240.0,
"buy_range_low": 1230.0,
"buy_range_high": 1250.0,
"qty": 6,
"stop_loss": 1190.0,
"target_1": 1290.0,
"target_2": 1340.0,
"expected_days": 7,
"risk_score": 2,
"risk_label": "Low",
"charges_estimate": 40.0,
"net_profit_t1": 260.0,
"net_profit_t2": 560.0,
"why_selected": "2 sentences based on news.",
"key_risks": "1 sentence."
}}
]
}}"""

    data = await call_llm(
        f"plan-{datetime.now(timezone.utc).strftime('%Y%m%d%H')}-{req.risk_appetite}",
        prompt,
    )
    for p in data.get("picks", []):
        live = get_live_price(p.get("symbol", ""))
        if live:
            p["current_price"] = live
            p["price_source"] = "prev_close"
        else:
            p["price_source"] = "ai_estimate"
    return data

@api_router.post("/portfolio-advice")
async def portfolio_advice(req: PortfolioRequest):
    if not req.holdings:
        return {"items": []}

    holdings_str = "\n".join(
        f"- {h.symbol}: qty {h.qty} bought at Rs{h.buy_price}" for h in req.holdings
    )

    news = get_market_news()
    news_str = "\n".join(news) if news else "No news available"

    live_prices = {}
    for h in req.holdings:
        price = get_live_price(h.symbol)
        if price:
            live_prices[h.symbol] = price

    live_str = "\n".join([f"- {s}: Rs{p} (live)" for s, p in live_prices.items()]) if live_prices else "Live prices unavailable"

    prompt = f"""User portfolio:

{holdings_str}

LIVE PRICES TODAY:
{live_str}

LATEST NEWS:
{news_str}

Give advice based on REAL live prices and news as JSON:
{{
"items": [
{{
"symbol": "TICKER",
"current_price": 1234.5,
"advice": "HOLD|SELL|ADD|TRIM",
"exit_target": 1300.0,
"stop_loss": 1180.0,
"reason": "1-2 sentence reason based on real news."
}}
]
}}"""

    data = await call_llm(f"portfolio-{uuid.uuid4().hex[:8]}", prompt)
    for it in data.get("items", []):
        symbol = it.get("symbol", "")
        if symbol in live_prices:
            it["current_price"] = live_prices[symbol]
            it["price_source"] = "prev_close"
        else:
            it["price_source"] = "ai_estimate"
    return data

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()