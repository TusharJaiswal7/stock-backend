from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, json, re, logging, uuid, httpx, requests
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

load_dotenv()

mongo_url = os.environ[‘MONGO_URL’]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ[‘DB_NAME’]]

GROQ_API_KEY = os.environ.get(‘GROQ_API_KEY’)
NEWS_API_KEY = os.environ.get(‘NEWS_API_KEY’)

app = FastAPI(title=“Stock Advisor AI India”)
api_router = APIRouter(prefix=”/api”)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(**name**)

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
risk_appetite: str = “conservative”

EXPERT_PERSONA = “”“You are a 25-year veteran Indian stock market expert specializing in NSE/BSE listed stocks. You are extremely conservative, focused on capital protection FIRST. You only suggest DELIVERY-based SWING trades (3-15 days holding).
Strict rules:

- NEVER recommend penny stocks (price < Rs50) or stocks with market cap < Rs5000 cr.
- Only suggest fundamentally strong large-cap or quality mid-cap stocks (Nifty 500 universe).
- Always prioritize capital safety over high returns.
- Consider broker charges (~0.5% round-trip).
- Available capital is Rs25,000 - suggest phased entries (max 30-40% per single trade).
- Risk-reward minimum 1:1.5. Stop loss must be tight (3-5% below entry).
  You ALWAYS respond in pure valid JSON ONLY - no markdown, no code fences, no explanation outside JSON.”””

def get_nse_headers():
return {
“User-Agent”: “Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36”,
“Accept”: “*/*”,
“Accept-Language”: “en-US,en;q=0.9”,
“Accept-Encoding”: “gzip, deflate, br”,
“Referer”: “https://www.nseindia.com/”,
“Connection”: “keep-alive”,
}

def get_nse_session():
session = requests.Session()
try:
session.get(
“https://www.nseindia.com”,
headers=get_nse_headers(),
timeout=10
)
except Exception:
pass
return session

def get_live_price(symbol: str):
“”“Fetch live NSE stock price using NSE India API.”””
try:
session = get_nse_session()
url = f”https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}”
r = session.get(url, headers=get_nse_headers(), timeout=10)
if r.status_code == 200:
data = r.json()
price = data.get(“priceInfo”, {}).get(“lastPrice”)
if price:
return round(float(price), 2)
except Exception as e:
logger.warning(f”NSE price fetch failed for {symbol}: {e}”)
return None

def get_live_nifty():
“”“Fetch live Nifty 50 index value from NSE India.”””
try:
session = get_nse_session()
r = session.get(
“https://www.nseindia.com/api/allIndices”,
headers=get_nse_headers(),
timeout=10
)
if r.status_code == 200:
data = r.json()
for index in data.get(“data”, []):
if index.get(“index”) == “NIFTY 50”:
return round(float(index.get(“last”, 0)), 2)
except Exception as e:
logger.warning(f”Nifty fetch failed: {e}”)
return None

def get_market_news():
“”“Fetch today’s Indian market news from NewsAPI.”””
if not NEWS_API_KEY:
return []
try:
url = “https://newsapi.org/v2/everything”
params = {
“q”: “NSE BSE Nifty Sensex Indian stock market”,
“language”: “en”,
“sortBy”: “publishedAt”,
“pageSize”: 5,
“apiKey”: NEWS_API_KEY
}
response = requests.get(url, params=params, timeout=10)
if response.status_code == 200:
articles = response.json().get(“articles”, [])
news = []
for a in articles[:5]:
news.append(f”- {a[‘title’]}”)
return news
except Exception as e:
logger.warning(f”News fetch failed: {e}”)
return []

def extract_json(text: str):
text = text.strip()
text = re.sub(r”^`(?:json)?\s*", "", text) text = re.sub(r"\s*`$”, “”, text)
m = re.search(r”[{[].*[}]]”, text, re.DOTALL)
if m:
text = m.group(0)
return json.loads(text)

async def call_llm(session_id: str, prompt: str) -> dict:
api_key = os.environ.get(‘GROQ_API_KEY’)
if not api_key:
raise HTTPException(status_code=500, detail=“GROQ_API_KEY not set.”)
full_prompt = f”{EXPERT_PERSONA}\n\n{prompt}”
payload = {
“model”: “llama-3.3-70b-versatile”,
“messages”: [{“role”: “user”, “content”: full_prompt}],
“temperature”: 0.7,
“max_tokens”: 2048
}
async with httpx.AsyncClient(timeout=60.0) as http:
response = await http.post(
“https://api.groq.com/openai/v1/chat/completions”,
json=payload,
headers={
“Authorization”: f”Bearer {api_key}”,
“Content-Type”: “application/json”
}
)
if response.status_code != 200:
raise HTTPException(status_code=502, detail=f”Groq error: {response.status_code}”)
data = response.json()
try:
raw_text = data[“choices”][0][“message”][“content”]
return extract_json(raw_text)
except Exception as e:
raise HTTPException(status_code=502, detail=“AI returned invalid format. Retry.”)

@api_router.get(”/”)
async def root():
return {“app”: “Stock Advisor AI India”, “status”: “ok”}

@api_router.get(”/health”)
async def health():
return {“status”: “ok”, “llm_configured”: bool(GROQ_API_KEY)}

@api_router.post(”/today-plan”)
async def today_plan(force: bool = False):
now = datetime.now(timezone.utc)
cache_key = now.strftime(”%Y-%m-%d”)
if not force:
cached = await db.today_plan_cache.find_one({“date”: cache_key}, {”_id”: 0})
if cached:
ts = datetime.fromisoformat(cached[“ts”])
if (now - ts) < timedelta(minutes=30):
return cached[“data”]

```
today_str = now.strftime("%A, %d %B %Y")

nifty = get_live_nifty()
news = get_market_news()

nifty_str = f"Current live Nifty 50 level: {nifty}" if nifty else "Nifty level unavailable"
news_str = "\n".join(news) if news else "No news available"

prompt = f"""Today is {today_str}.
```

LIVE MARKET DATA:
{nifty_str}

TODAY’S LATEST NEWS:
{news_str}

Using the above REAL live data, generate a swing-trader’s market plan for Indian retail investors with Rs25,000 capital.

Respond as a single JSON object:
{{
“market_mood”: “Bullish|Cautiously Bullish|Neutral|Cautiously Bearish|Bearish”,
“mood_reason”: “1 short sentence based on real news above max 15 words”,
“nifty_trend”: “Uptrend|Sideways|Downtrend”,
“nifty_note”: “1 short sentence mentioning actual Nifty level from live data”,
“buy_today”: [
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line based on news”, “buy_range”: “RsX-RsY”}},
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line based on news”, “buy_range”: “RsX-RsY”}},
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line based on news”, “buy_range”: “RsX-RsY”}}
],
“hold”: [
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line”}},
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line”}}
],
“sell”: [
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line”}}
],
“avoid_today”: [
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line”}},
{{“symbol”: “TICKER”, “name”: “Company”, “reason”: “1 line”}}
],
“capital_strategy”: “1-2 sentences on phased deployment of Rs25k today.”
}}”””

```
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
```

@api_router.post(”/stock-pick”)
async def stock_pick(req: StockPickRequest):
capital = 25000
live_price = None
if req.symbol:
live_price = get_live_price(req.symbol)

```
price_info = f"Current live NSE price: Rs{live_price}" if live_price else "Use your best estimate for current price"
target_clause = f"the stock {req.symbol}" if req.symbol else "ONE high-conviction Indian large/mid-cap stock"

news = get_market_news()
news_str = "\n".join(news) if news else "No news available"

prompt = f"""Generate a complete delivery swing-trade recommendation for {target_clause}.
```

{price_info}

LATEST NEWS:
{news_str}

Capital for this trade: max 35% of Rs{capital} = Rs{int(capital * 0.35)}.

Respond as JSON:
{{
“symbol”: “TICKER”,
“name”: “Full Company Name”,
“sector”: “Sector”,
“current_price”: 1234.5,
“buy_range_low”: 1220.0,
“buy_range_high”: 1240.0,
“qty”: 7,
“stop_loss”: 1180.0,
“target_1”: 1290.0,
“target_2”: 1340.0,
“expected_days”: 7,
“risk_score”: 3,
“risk_label”: “Low|Medium|High”,
“charges_estimate”: 65.0,
“net_profit_t1”: 420.0,
“net_profit_t2”: 765.0,
“why_selected”: “2-3 sentences based on real news and live price.”,
“key_risks”: “1 sentence.”
}}”””

```
sid = req.symbol or "auto"
data = await call_llm(f"pick-{sid}-{datetime.now().strftime('%Y%m%d%H')}", prompt)
if live_price:
    data["current_price"] = live_price
    data["price_source"] = "live"
else:
    data["price_source"] = "ai_estimate"
return data
```

@api_router.post(”/portfolio-plan”)
async def portfolio_plan(req: PortfolioPlanRequest):
news = get_market_news()
news_str = “\n”.join(news) if news else “No news available”
nifty = get_live_nifty()
nifty_str = f”Current live Nifty 50: {nifty}” if nifty else “”

```
prompt = f"""Build a swing-trade plan for Rs{int(req.capital)} capital. Risk: {req.risk_appetite}.
```

{nifty_str}

LATEST NEWS:
{news_str}

Pick 3-4 NSE stocks based on real news above. Respond as JSON:
{{
“total_capital”: {int(req.capital)},
“deployed”: 22500,
“reserve”: 2500,
“reserve_reason”: “1 line”,
“strategy_note”: “1-2 sentences based on real market conditions”,
“picks”: [
{{
“symbol”: “TICKER”,
“name”: “Company”,
“sector”: “Sector”,
“allocation”: 8000,
“current_price”: 1240.0,
“buy_range_low”: 1230.0,
“buy_range_high”: 1250.0,
“qty”: 6,
“stop_loss”: 1190.0,
“target_1”: 1290.0,
“target_2”: 1340.0,
“expected_days”: 7,
“risk_score”: 2,
“risk_label”: “Low”,
“charges_estimate”: 40.0,
“net_profit_t1”: 260.0,
“net_profit_t2”: 560.0,
“why_selected”: “2 sentences based on news.”,
“key_risks”: “1 sentence.”
}}
]
}}”””

```
data = await call_llm(
    f"plan-{datetime.now(timezone.utc).strftime('%Y%m%d%H')}-{req.risk_appetite}",
    prompt,
)
for p in data.get("picks", []):
    live = get_live_price(p.get("symbol", ""))
    if live:
        p["current_price"] = live
        p["price_source"] = "live"
    else:
        p["price_source"] = "ai_estimate"
return data
```

@api_router.post(”/portfolio-advice”)
async def portfolio_advice(req: PortfolioRequest):
if not req.holdings:
return {“items”: []}

```
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
```

{holdings_str}

LIVE PRICES TODAY:
{live_str}

LATEST NEWS:
{news_str}

Give advice based on REAL live prices and news as JSON:
{{
“items”: [
{{
“symbol”: “TICKER”,
“current_price”: 1234.5,
“advice”: “HOLD|SELL|ADD|TRIM”,
“exit_target”: 1300.0,
“stop_loss”: 1180.0,
“reason”: “1-2 sentence reason based on real news.”
}}
]
}}”””

```
data = await call_llm(f"portfolio-{uuid.uuid4().hex[:8]}", prompt)
for it in data.get("items", []):
    symbol = it.get("symbol", "")
    if symbol in live_prices:
        it["current_price"] = live_prices[symbol]
        it["price_source"] = "live"
    else:
        it["price_source"] = "ai_estimate"
return data
```

app.include_router(api_router)
app.add_middleware(
CORSMiddleware,
allow_credentials=True,
allow_origins=os.environ.get(‘CORS_ORIGINS’, ‘*’).split(’,’),
allow_methods=[”*”],
allow_headers=[”*”],
)

@app.on_event(“shutdown”)
async def shutdown_db_client():
client.close()