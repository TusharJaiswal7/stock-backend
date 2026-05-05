/**
 * Netlify Function: stock-price
 * Fetches live NSE price from Yahoo Finance server-side.
 * Called from the browser as /.netlify/functions/stock-price?symbol=ICICIBANK
 *
 * No CORS issues — same Netlify domain.
 * Netlify's IPs are not blocked by Yahoo Finance unlike Render.com IPs.
 */

exports.handler = async (event) => {
  const symbol = event.queryStringParameters?.symbol;

  if (!symbol) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "symbol query param required" }),
    };
  }

  const ticker = symbol.includes(".") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockAdvisor/1.0)",
      },
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `Yahoo returned ${res.status}` }),
      };
    }

    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof price !== "number") {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Price not found in response" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, ticker, price }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
