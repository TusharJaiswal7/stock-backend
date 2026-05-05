import { useEffect, useState } from "react";
import { Plus, Trash, Sparkle, ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react";
import { Input } from "../components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { toast } from "sonner";
import { loadPortfolio, savePortfolio } from "../lib/storage";
import { fetchPortfolioAdvice } from "../lib/api";
import { fetchLivePriceBrowser } from "../lib/priceEnricher";

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : n;

export const Portfolio = () => {
  const [items, setItems] = useState([]);
  const [advice, setAdvice] = useState({});
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [open, setOpen] = useState(false);

  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    setItems(loadPortfolio());
  }, []);

  useEffect(() => {
    savePortfolio(items);
  }, [items]);

  const totalInvested = items.reduce((s, h) => s + h.qty * h.buy_price, 0);
  const totalCurrent = items.reduce(
    (s, h) => s + h.qty * (advice[h.symbol]?.current_price ?? h.buy_price),
    0
  );
  const totalPnl = totalCurrent - totalInvested;

  const handleAdd = () => {
    const s = symbol.trim().toUpperCase();
    const q = parseInt(qty);
    const p = parseFloat(price);
    if (!s || !q || !p || q <= 0 || p <= 0) {
      toast.error("Please enter valid stock, quantity, and buy price.");
      return;
    }
    setItems((prev) => [...prev, { symbol: s, qty: q, buy_price: p }]);
    setSymbol("");
    setQty("");
    setPrice("");
    setOpen(false);
    toast.success(`${s} added to portfolio`);
  };

  const handleDelete = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Removed");
  };

  const fetchAdvice = async () => {
    if (items.length === 0) {
      toast.error("Add at least one holding first");
      return;
    }
    try {
      setLoadingAdvice(true);
      const r = await fetchPortfolioAdvice(items);
      // Fetch live prices for each holding directly from the browser
      const liveResults = await Promise.all(
        (r.items || []).map(async (it) => {
          const livePrice = await fetchLivePriceBrowser(it.symbol);
          return livePrice !== null
            ? { ...it, current_price: livePrice, price_source: "live" }
            : { ...it, price_source: "ai_est" };
        })
      );
      const map = {};
      liveResults.forEach((it) => (map[it.symbol] = it));
      setAdvice(map);
      toast.success("AI advice updated");
    } catch (e) {
      toast.error("Could not fetch advice. Try again.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div data-testid="portfolio-page" className="px-4 pt-4 space-y-4">
      <div>
        <h1 className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>
          Portfolio
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Track your holdings & get AI-driven hold/sell advice.
        </p>
      </div>

      {/* Summary card */}
      <div
        className="hero-card p-5"
        style={{ background: "var(--primary)", minHeight: 130 }}
      >
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">
          Total P&L
        </p>
        <p
          className="font-display text-4xl mt-1 tabular-nums"
          style={{ color: totalPnl >= 0 ? "#A8D8B5" : "#F0A28E" }}
        >
          {totalPnl >= 0 ? "+" : ""}₹{fmt(Math.abs(totalPnl))}
        </p>
        <div className="flex justify-between mt-4 pt-4 border-t border-white/15">
          <div>
            <p className="text-[9.5px] uppercase tracking-widest text-white/50 font-bold">
              Invested
            </p>
            <p className="font-display text-base text-white tabular-nums mt-0.5">
              ₹{fmt(totalInvested)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9.5px] uppercase tracking-widest text-white/50 font-bold">
              Current
            </p>
            <p className="font-display text-base text-white tabular-nums mt-0.5">
              ₹{fmt(totalCurrent)}
            </p>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              data-testid="open-add-holding-btn"
              className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-full font-bold text-white text-sm active:scale-95 transition"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={16} weight="bold" /> Add Holding
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl border-0 max-w-md mx-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl text-left">
                Add Holding
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-3 mt-4">
              <div>
                <label className="label-overline">NSE Ticker</label>
                <Input
                  data-testid="holding-symbol-input"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. ITC"
                  className="mt-1.5 h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-overline">Quantity</label>
                  <Input
                    data-testid="holding-qty-input"
                    type="number"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="10"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <label className="label-overline">Buy Price (₹)</label>
                  <Input
                    data-testid="holding-price-input"
                    type="number"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="450"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
              </div>
              <button
                data-testid="save-holding-btn"
                onClick={handleAdd}
                className="w-full h-12 rounded-full font-bold text-white text-sm active:scale-95 transition mt-2"
                style={{ background: "var(--primary)" }}
              >
                Save Holding
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <button
          data-testid="get-advice-btn"
          onClick={fetchAdvice}
          disabled={loadingAdvice || items.length === 0}
          className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-full font-bold text-sm border bg-white disabled:opacity-50 active:scale-95 transition"
          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
        >
          <Sparkle size={16} weight="fill" color="var(--accent-hold)" />
          {loadingAdvice ? "..." : "AI Advice"}
        </button>
      </div>

      {items.length === 0 ? (
        <div
          className="text-center py-12 rounded-2xl border-2 border-dashed"
          style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
        >
          <p className="text-[13px]">No holdings yet.</p>
          <p className="text-[11px] mt-1">Tap "Add Holding" to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((h, i) => {
            const a = advice[h.symbol];
            const cur = a?.current_price ?? h.buy_price;
            const pnl = (cur - h.buy_price) * h.qty;
            const pnlPct = ((cur - h.buy_price) / h.buy_price) * 100;
            const isUp = pnl >= 0;
            return (
              <div
                key={i}
                data-testid={`holding-${h.symbol}`}
                className="bg-white border rounded-2xl p-4 fade-up"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg" style={{ color: "var(--text-primary)" }}>
                      {h.symbol}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      {h.qty} qty · avg ₹{fmt(h.buy_price)}
                      {a && (
                        <span
                          className="ml-2 text-[8.5px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background:
                              a.price_source === "live"
                                ? "rgba(46, 109, 78, 0.12)"
                                : "rgba(212, 139, 62, 0.12)",
                            color:
                              a.price_source === "live"
                                ? "var(--accent-buy)"
                                : "var(--accent-hold)",
                          }}
                        >
                          {a.price_source === "live" ? "● Live" : "AI Est."}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="font-display text-base tabular-nums flex items-center gap-1 justify-end"
                      style={{ color: isUp ? "var(--accent-buy)" : "var(--accent-sell)" }}
                    >
                      {isUp ? <ArrowUpRight size={14} weight="bold" /> : <ArrowDownRight size={14} weight="bold" />}
                      {isUp ? "+" : ""}₹{fmt(Math.abs(pnl))}
                    </p>
                    <p
                      className="text-[10.5px] tabular-nums font-semibold"
                      style={{ color: isUp ? "var(--accent-buy)" : "var(--accent-sell)" }}
                    >
                      {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {a && (
                  <div
                    className="mt-3 pt-3 border-t flex items-start gap-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="pill text-[10px] font-bold"
                      style={{
                        background:
                          a.advice === "SELL"
                            ? "rgba(183, 92, 70, 0.12)"
                            : a.advice === "ADD"
                              ? "rgba(46, 109, 78, 0.12)"
                              : "rgba(212, 139, 62, 0.12)",
                        color:
                          a.advice === "SELL"
                            ? "var(--accent-sell)"
                            : a.advice === "ADD"
                              ? "var(--accent-buy)"
                              : "var(--accent-hold)",
                      }}
                    >
                      {a.advice}
                    </span>
                    <div className="flex-1 text-[12px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                      <p>{a.reason}</p>
                      <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
                        Exit ₹{fmt(a.exit_target)} · SL ₹{fmt(a.stop_loss)}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  data-testid={`delete-${h.symbol}`}
                  onClick={() => handleDelete(i)}
                  className="mt-2 text-[11px] flex items-center gap-1 font-bold uppercase tracking-wider"
                  style={{ color: "var(--accent-sell)" }}
                >
                  <Trash size={11} weight="bold" /> Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
