import { useEffect, useState } from "react";
import { fetchStockPick, fetchPortfolioPlan } from "../lib/api";
import { enrichPickWithLivePrice, enrichPicksWithLivePrices } from "../lib/priceEnricher";
import { StockCard } from "./StockCard";
import { Skeleton } from "../components/ui/skeleton";
import { Plus, Sparkle, Wallet, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : n;

export const PicksPage = () => {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [symbolInput, setSymbolInput] = useState("");

  const generate = async (symbol) => {
    try {
      const raw = await fetchStockPick(symbol);
      // Fetch live price from browser (Yahoo Finance) — never blocked
      const p = await enrichPickWithLivePrice(raw);
      setPicks((prev) => {
        const exists = prev.find((x) => x.symbol === p.symbol);
        return exists ? prev.map((x) => (x.symbol === p.symbol ? p : x)) : [p, ...prev];
      });
    } catch (e) {
      toast.error("AI couldn't generate this pick. Try another ticker.");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await generate(null);
      setLoading(false);
    })();
  }, []);

  const onAdd = async () => {
    const sym = symbolInput.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    await generate(sym);
    setSymbolInput("");
    setAdding(false);
  };

  const onAuto = async () => {
    setAdding(true);
    await generate(null);
    setAdding(false);
  };

  const onGeneratePlan = async () => {
    try {
      setPlanLoading(true);
      const data = await fetchPortfolioPlan("conservative");
      // Enrich plan picks with live browser prices concurrently
      const enrichedPicks = await enrichPicksWithLivePrices(data.picks);
      const enrichedData = { ...data, picks: enrichedPicks };
      setPlan(enrichedData);
      // push picks into the cards stream
      setPicks((prev) => {
        const map = new Map(prev.map((x) => [x.symbol, x]));
        enrichedPicks.forEach((p) => map.set(p.symbol, p));
        return Array.from(map.values());
      });
      toast.success("₹25k plan ready");
    } catch (e) {
      toast.error("Could not generate plan. Try again.");
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div data-testid="picks-page" className="px-4 pt-4 space-y-4">
      <div>
        <h1 className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>
          Swing Picks
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
          Detailed AI recommendations sized for ₹25,000 capital.
        </p>
      </div>

      {/* Generate full ₹25k plan */}
      <button
        data-testid="generate-plan-btn"
        onClick={onGeneratePlan}
        disabled={planLoading}
        className="w-full flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left active:scale-[0.99] transition disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #224834 0%, #1A3A29 100%)",
          color: "#fff",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <Wallet size={20} weight="fill" color="#fff" />
          </div>
          <div>
            <p className="font-display text-[15px] leading-tight">
              {planLoading ? "Building your plan…" : "Generate ₹25,000 Plan"}
            </p>
            <p className="text-[11px] text-white/70 mt-0.5">
              AI splits capital across 3-4 strong picks
            </p>
          </div>
        </div>
        <Lightning
          size={20}
          weight="fill"
          color="#D48B3E"
          className={planLoading ? "animate-pulse" : ""}
        />
      </button>

      {/* Plan summary */}
      {plan && (
        <div
          className="bento fade-up"
          style={{
            background: "linear-gradient(180deg, #EAF0EC 0%, #FFFFFF 100%)",
            borderColor: "#CDDCD2",
          }}
        >
          <p className="label-overline mb-2" style={{ color: "var(--accent-buy)" }}>
            ₹25,000 Deployment Plan
          </p>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--text-tertiary)" }}>
                Deploy
              </p>
              <p className="font-display text-xl tabular-nums" style={{ color: "var(--primary)" }}>
                ₹{fmt(plan.deployed)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--text-tertiary)" }}>
                Reserve
              </p>
              <p className="font-display text-xl tabular-nums" style={{ color: "var(--accent-hold)" }}>
                ₹{fmt(plan.reserve)}
              </p>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {plan.strategy_note}
          </p>
          <p className="text-[11px] leading-relaxed mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            <span className="font-bold uppercase tracking-wider">Reserve: </span>
            {plan.reserve_reason}
          </p>
          {/* Allocation pills */}
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            {plan.picks.map((p) => (
              <span
                key={p.symbol}
                className="pill text-[10.5px]"
                style={{
                  background: "rgba(34, 72, 52, 0.08)",
                  color: "var(--primary)",
                }}
              >
                <span className="font-display">{p.symbol}</span>
                <span className="opacity-60">·</span>
                <span className="tabular-nums">₹{fmt(p.allocation)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual add row */}
      <div className="flex gap-2 items-stretch">
        <Input
          data-testid="pick-symbol-input"
          placeholder="Enter NSE ticker (e.g. ITC)"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          className="rounded-full bg-white h-11"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          data-testid="add-pick-btn"
          onClick={onAdd}
          disabled={adding || !symbolInput.trim()}
          className="flex items-center justify-center gap-1.5 rounded-full px-4 font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition"
          style={{ background: "var(--primary)" }}
        >
          <Plus size={16} weight="bold" />
        </button>
        <button
          data-testid="ai-auto-pick-btn"
          onClick={onAuto}
          disabled={adding}
          className="flex items-center justify-center gap-1.5 rounded-full px-4 font-bold text-sm border bg-white disabled:opacity-50 active:scale-95 transition"
          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
        >
          <Sparkle size={16} weight="fill" color="var(--accent-hold)" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-72 rounded-2xl bg-white" />
          <Skeleton className="h-72 rounded-2xl bg-white" />
        </div>
      ) : (
        <div className="space-y-3">
          {picks.map((p, i) => (
            <StockCard key={p.symbol + i} pick={p} index={i} />
          ))}
        </div>
      )}

      {(adding || planLoading) && (
        <div className="text-center py-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          AI is analysing the chart…
        </div>
      )}
    </div>
  );
};
