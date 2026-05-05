from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, json, re, logging, uuid, httpx
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

load_dotenv()

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

STOCK_API_PROVIDER = os.environ.get('STOCK_API_PROVIDER', '').strip().lower()

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
- Available capital is Rs25,000 — suggest phased entries (max 30-40% per single trade).
- Risk-reward minimum 1:1.5. Stop loss must be tight (3-5% below entry).
You ALWAYS respond in pure valid JSON ONLY — no markdown, no code fences, no explanation outside JSON."""

def extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    m = re.search(r"[\{\[].*[\}\]]", text, re.DOTALL)
    if m:
        text = m.group(0)
    return json.loads(text)

async def fetch_live_price(symbol: str):
    return None

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
    return {"status": "ok", "llm_configured": bool(GEMINI_API_KEY)}

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
    prompt = f"""Today is {today_str}. Generate a swing-trader's market plan for Indian retail investors with Rs25,000 capital.
Respond as a single JSON object:
{{
  "market_mood": "Bullish|Cautiously Bullish|Neutral|Cautiously Bearish|Bearish",
  "mood_reason": "1 short sentence max 15 words",
  "nifty_trend": "Uptrend|Sideways|Downtrend",
  "nifty_note": "1 short sentence",
  "buy_today": [
    {{"symbol": "TICKER", "name": "Company", "reason": "1 line", "buy_range": "RsX-RsY"}},
    {{"symbol": "TICKER", "name": "Company", "reason": "1 line", "buy_range": "RsX-RsY"}},
    {{"symbol": "TICKER", "name": "Company", "reason": "1 line", "buy_range": "RsX-RsY"}}
  ],
  "hold": [{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}},{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}],
  "sell": [{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}],
  "avoid_today": [{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}},{{"symbol": "TICKER", "name": "Company", "reason": "1 line"}}],
  "capital_strategy": "1-2 sentences on phased deployment of Rs25k today."
}}"""
    data = await call_llm(f"today-plan-{cache_key}", prompt)
    data["generated_at"] = now.isoformat()
    await db.today_plan_cache.update_one(
        {"date": cache_key},
        {"$set": {"date": cache_key, "ts": now.isoformat(), "data": data}},
        upsert=True,
    )
    return data

@api_router.post("/stock-pick")
async def stock_pick(req: StockPickRequest):
    capital = 25000
    target_clause = f"the stock {req.symbol}" if req.symbol else "ONE high-conviction Indian large/mid-cap stock"
    prompt = f"""Generate a complete delivery swing-trade recommendation for {target_clause}.
Respond as JSON:
{{
  "symbol": "TICKER", "name": "Full Company Name", "sector": "Sector",
  "current_price": 1234.5, "buy_range_low": 1220.0, "buy_range_high": 1240.0,
  "qty": 7, "stop_loss": 1180.0, "target_1": 1290.0, "target_2": 1340.0,
  "expected_days": 7, "risk_score": 3, "risk_label": "Low|Medium|High",
  "charges_estimate": 65.0, "net_profit_t1": 420.0, "net_profit_t2": 765.0,
  "why_selected": "2-3 sentences.", "key_risks": "1 sentence."
}}"""
    sid = req.symbol or "auto"
    data = await call_llm(f"pick-{sid}-{datetime.now().strftime('%Y%m%d%H')}", prompt)
    data["price_source"] = "ai_estimate"
    return data

@api_router.post("/portfolio-plan")
async def portfolio_plan(req: PortfolioPlanRequest):
    prompt = f"""Build a swing-trade plan for Rs{int(req.capital)} capital. Risk: {req.risk_appetite}.
Pick 3-4 NSE stocks. Respond as JSON:
{{
  "total_capital": {int(req.capital)}, "deployed": 22500, "reserve": 2500,
  "reserve_reason": "1 line", "strategy_note": "1-2 sentences",
  "picks": [
    {{"symbol": "TICKER", "name": "Company", "sector": "Sector",
      "allocation": 8000, "current_price": 1240.0,
      "buy_range_low": 1230.0, "buy_range_high": 1250.0,
      "qty": 6, "stop_loss": 1190.0, "target_1": 1290.0, "target_2": 1340.0,
      "expected_days": 7, "risk_score": 2, "risk_label": "Low",
      "charges_estimate": 40.0, "net_profit_t1": 260.0, "net_profit_t2": 560.0,
      "why_selected": "2 sentences.", "key_risks": "1 sentence."}}
  ]
}}"""
    data = await call_llm(f"plan-{datetime.now(timezone.utc).strftime('%Y%m%d%H')}-{req.risk_appetite}", prompt)
    for p in data.get("picks", []):
        p["price_source"] = "ai_estimate"
    return data

@api_router.post("/portfolio-advice")
async def portfolio_advice(req: PortfolioRequest):
    if not req.holdings:
        return {"items": []}
    holdings_str = "\n".join(f"- {h.symbol}: qty {h.qty} bought at Rs{h.buy_price}" for h in req.holdings)
    prompt = f"""User portfolio:\n{holdings_str}\nGive advice as JSON:
{{
  "items": [
    {{"symbol": "TICKER", "current_price": 1234.5,
      "advice": "HOLD|SELL|ADD|TRIM",
      "exit_target": 1300.0, "stop_loss": 1180.0, "reason": "1-2 sentences."}}
  ]
}}"""
    data = await call_llm(f"portfolio-{uuid.uuid4().hex[:8]}", prompt)
    for it in data.get("items", []):
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
