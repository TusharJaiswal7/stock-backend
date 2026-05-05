/**
 * priceEnricher.js
 *
 * Fetches live NSE stock prices via a Netlify serverless function.
 * The function runs on Netlify's servers (not Render) so Yahoo Finance
 * never blocks it. No CORS issues since it's the same domain.
 *
 * Function endpoint: /.netlify/functions/stock-price?symbol=ICICIBANK
 */

/**
 * Fetch a single live price for an NSE symbol.
 * Returns the price as a number, or null if fetch fails.
 */
export async function fetchLivePriceBrowser(symbol) {
  if (!symbol) return null;
  try {
    const res = await fetch(
      `/.netlify/functions/stock-price?symbol=${encodeURIComponent(symbol)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.price === "number" ? data.price : null;
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
