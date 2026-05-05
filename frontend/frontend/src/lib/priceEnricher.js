/**
 * priceEnricher.js
 *
 * Fetches live NSE stock prices from the browser via Yahoo Finance.
 * Routes through corsproxy.io to bypass CORS restrictions.
 *
 * Price path: data.chart.result[0].meta.regularMarketPrice
 * Symbol format: HDFCBANK → HDFCBANK.NS
 */

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const CORS_PROXY = "https://corsproxy.io/?";

/**
 * Fetch a single live price for an NSE symbol.
 * Returns the price as a number, or null if fetch fails.
 */
export async function fetchLivePriceBrowser(symbol) {
  if (!symbol) return null;
  const ticker = symbol.includes(".") ? symbol : `${symbol}.NS`;
  const yahooUrl = `${YAHOO_BASE}/${ticker}?interval=1d&range=1d`;
  const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(yahooUrl)}`;

  try {
    const res = await fetch(proxiedUrl);
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

/**
 * Enrich a single pick/item object with a live price.
 * Sets  pick.current_price  and  pick.price_source.
 * Returns a new object (does not mutate the original).
 */
export async function enrichPickWithLivePrice(pick) {
  if (!pick?.symbol) return pick;
  const livePrice = await fetchLivePriceBrowser(pick.symbol);
  if (livePrice !== null) {
    return { ...pick, current_price: livePrice, price_source: "live" };
  }
  return { ...pick, price_source: "ai_est" };
}

/**
 * Enrich an array of picks concurrently.
 * Safe — individual failures don't abort the whole batch.
 */
export async function enrichPicksWithLivePrices(picks) {
  if (!Array.isArray(picks)) return picks;
  return Promise.all(picks.map((p) => enrichPickWithLivePrice(p)));
}
