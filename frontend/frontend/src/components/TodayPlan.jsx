import { useEffect, useState } from "react";
import { fetchTodayPlan } from "../lib/api";
import { ArrowsClockwise, TrendUp, TrendDown, ArrowRight, Minus } from "@phosphor-icons/react";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/92b98fe4-1988-4d01-b248-6daff90afef5/images/7d672c3e2626a6dbfd6b972e7fef36608eadd370d69f9b5f9dbd1ebc002c9b0d.png";

const moodColor = {
  Bullish: "#2E6D4E",
  "Cautiously Bullish": "#5A8C5E",
  Neutral: "#8A928D",
  "Cautiously Bearish": "#C68861",
  Bearish: "#B75C46",
};

const TrendIcon = ({ trend, color = "#fff" }) => {
  if (trend === "Uptrend") return <TrendUp size={14} weight="bold" color={color} />;
  if (trend === "Downtrend") return <TrendDown size={14} weight="bold" color={color} />;
  return <Minus size={14} weight="bold" color={color} />;
};

const SectionList = ({ title, items, accent, testId }) => (
  <div data-testid={testId} className="bento fade-up">
    <p className="label-overline mb-2.5">{title}</p>
    <div className="space-y-2.5">
      {items?.map((it, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span
            className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accent }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-[15px]" style={{ color: "var(--text-primary)" }}>
                {it.symbol}
              </p>
              <p className="text-[10.5px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {it.name}
              </p>
            </div>
            <p className="text-[12px] leading-snug mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {it.reason}
              {it.buy_range && (
                <span className="ml-1 font-semibold" style={{ color: "var(--primary)" }}>
                  · {it.buy_range}
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TodayPlan = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    try {
      force ? setRefreshing(true) : setLoading(true);
      const d = await fetchTodayPlan(force);
      setData(d);
    } catch (e) {
      toast.error("Failed to load today's plan. AI may be busy — try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  return (
    <div data-testid="today-plan-page" className="px-4 pt-4 space-y-4">
      {/* Hero */}
      <div
        className="hero-card p-6"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: 220,
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold">
              Today's Plan
            </p>
            <p className="text-white/85 text-xs mt-1 font-medium">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <button
            data-testid="refresh-plan-btn"
            onClick={() => load(true)}
            disabled={refreshing}
            className="pill pill-glass active:scale-95 transition"
          >
            <ArrowsClockwise
              size={12}
              weight="bold"
              className={refreshing ? "animate-spin" : ""}
            />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40 bg-white/20" />
            <Skeleton className="h-4 w-56 bg-white/15" />
            <Skeleton className="h-12 w-full bg-white/15 mt-4" />
          </div>
        ) : data ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              <span
                className="pill pill-glass"
                style={{ borderColor: moodColor[data.market_mood] }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: moodColor[data.market_mood] }}
                />
                {data.market_mood}
              </span>
              <span className="pill pill-glass">
                <TrendIcon trend={data.nifty_trend} />
                Nifty · {data.nifty_trend}
              </span>
            </div>
            <p className="text-white text-[13px] leading-relaxed font-medium">
              {data.mood_reason}
            </p>
            <p className="text-white/70 text-[11px] leading-relaxed mt-2">
              {data.nifty_note}
            </p>

            <div className="mt-5 pt-5 border-t border-white/15">
              <p className="text-white/60 text-[10px] uppercase tracking-[0.18em] font-bold mb-1">
                Capital Strategy · ₹25,000
              </p>
              <p className="text-white text-[12px] leading-relaxed">
                {data.capital_strategy}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Buy Today */}
      {data?.buy_today && (
        <div
          className="bento fade-up"
          style={{
            background: "linear-gradient(180deg, #EAF0EC 0%, #FFFFFF 100%)",
            borderColor: "#CDDCD2",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="label-overline" style={{ color: "var(--accent-buy)" }}>
              Top 3 Buys Today
            </p>
            <ArrowRight size={14} weight="bold" color="var(--accent-buy)" />
          </div>
          <div className="space-y-3">
            {data.buy_today.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-display text-[13px] flex-shrink-0"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-base" style={{ color: "var(--text-primary)" }}>
                      {s.symbol}
                    </p>
                    <p
                      className="text-[11px] font-semibold tabular-nums"
                      style={{ color: "var(--accent-buy)" }}
                    >
                      {s.buy_range}
                    </p>
                  </div>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {s.name}
                  </p>
                  <p
                    className="text-[12px] leading-snug mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {s.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hold / Sell / Avoid */}
      {data?.hold && (
        <SectionList
          testId="hold-section"
          title="Hold"
          items={data.hold}
          accent="var(--accent-hold)"
        />
      )}
      {data?.sell && (
        <SectionList
          testId="sell-section"
          title="Sell"
          items={data.sell}
          accent="var(--accent-sell)"
        />
      )}
      {data?.avoid_today && (
        <SectionList
          testId="avoid-section"
          title="Avoid Today"
          items={data.avoid_today}
          accent="var(--text-tertiary)"
        />
      )}
    </div>
  );
};
