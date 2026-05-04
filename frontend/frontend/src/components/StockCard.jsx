import { ShieldCheck, Target, Clock, CurrencyInr, ChartLine, Lightbulb } from "@phosphor-icons/react";

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : n;

const riskColor = (label) => {
  if (label === "Low") return "var(--accent-buy)";
  if (label === "High") return "var(--accent-sell)";
  return "var(--accent-hold)";
};

export const StockCard = ({ pick, index = 0 }) => {
  if (!pick) return null;
  return (
    <div
      data-testid={`stock-card-${pick.symbol}`}
      className="bg-white border rounded-2xl p-5 fade-up"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 2px 8px -4px rgba(34, 72, 52, 0.08)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-display text-2xl" style={{ color: "var(--text-primary)" }}>
              {pick.symbol}
            </p>
            <span
              className="text-[8.5px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
              style={{
                background:
                  pick.price_source === "live"
                    ? "rgba(46, 109, 78, 0.12)"
                    : "rgba(212, 139, 62, 0.12)",
                color:
                  pick.price_source === "live"
                    ? "var(--accent-buy)"
                    : "var(--accent-hold)",
              }}
            >
              {pick.price_source === "live" ? "● Live" : "AI Est."}
            </span>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {pick.name} · {pick.sector}
          </p>
        </div>
        <div className="text-right">
          <p className="label-overline">CMP</p>
          <p
            className="font-display text-xl tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            ₹{fmt(pick.current_price)}
          </p>
        </div>
      </div>

      {/* Buy Range / Qty bar */}
      <div
        className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl"
        style={{ background: "#EAF0EC" }}
      >
        <div>
          <p
            className="text-[9.5px] uppercase tracking-widest font-bold"
            style={{ color: "var(--accent-buy)" }}
          >
            Buy Range
          </p>
          <p
            className="font-display text-[15px] tabular-nums"
            style={{ color: "var(--primary)" }}
          >
            ₹{fmt(pick.buy_range_low)} – ₹{fmt(pick.buy_range_high)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] uppercase tracking-widest font-bold" style={{ color: "var(--accent-buy)" }}>
            Qty (₹25k)
          </p>
          <p className="font-display text-[15px] tabular-nums" style={{ color: "var(--primary)" }}>
            {pick.qty}
          </p>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <Metric
          icon={<ShieldCheck size={14} weight="duotone" color="var(--accent-sell)" />}
          label="Stop Loss"
          value={`₹${fmt(pick.stop_loss)}`}
          color="var(--accent-sell)"
        />
        <Metric
          icon={<Clock size={14} weight="duotone" color="var(--text-secondary)" />}
          label="Days"
          value={`${pick.expected_days}d`}
        />
        <Metric
          icon={<Target size={14} weight="duotone" color="var(--accent-buy)" />}
          label="Target 1"
          value={`₹${fmt(pick.target_1)}`}
          color="var(--accent-buy)"
        />
        <Metric
          icon={<Target size={14} weight="duotone" color="var(--accent-buy)" />}
          label="Target 2"
          value={`₹${fmt(pick.target_2)}`}
          color="var(--accent-buy)"
        />
        <Metric
          icon={<ChartLine size={14} weight="duotone" color={riskColor(pick.risk_label)} />}
          label="Risk"
          value={`${pick.risk_label} · ${pick.risk_score}/5`}
          color={riskColor(pick.risk_label)}
        />
        <Metric
          icon={<CurrencyInr size={14} weight="duotone" color="var(--text-secondary)" />}
          label="Charges"
          value={`~₹${fmt(pick.charges_estimate)}`}
        />
      </div>

      {/* Net profit */}
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <div
          className="rounded-xl p-2.5"
          style={{ background: "rgba(46, 109, 78, 0.09)" }}
        >
          <p className="text-[9.5px] uppercase tracking-widest font-bold" style={{ color: "var(--accent-buy)" }}>
            Net @ T1
          </p>
          <p className="font-display text-[15px] tabular-nums" style={{ color: "var(--accent-buy)" }}>
            +₹{fmt(pick.net_profit_t1)}
          </p>
        </div>
        <div
          className="rounded-xl p-2.5"
          style={{ background: "rgba(46, 109, 78, 0.16)" }}
        >
          <p className="text-[9.5px] uppercase tracking-widest font-bold" style={{ color: "var(--accent-buy)" }}>
            Net @ T2
          </p>
          <p className="font-display text-[15px] tabular-nums" style={{ color: "var(--accent-buy)" }}>
            +₹{fmt(pick.net_profit_t2)}
          </p>
        </div>
      </div>

      {/* Why selected */}
      <div
        className="mt-3 p-3 rounded-xl"
        style={{ background: "var(--surface-muted)" }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lightbulb size={13} weight="fill" color="var(--accent-hold)" />
          <p className="label-overline" style={{ color: "var(--text-secondary)" }}>
            Why Selected
          </p>
        </div>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {pick.why_selected}
        </p>
        {pick.key_risks && (
          <p
            className="text-[11px] leading-relaxed mt-2 pt-2 border-t"
            style={{ color: "var(--accent-sell)", borderColor: "var(--border)" }}
          >
            <span className="font-bold uppercase tracking-wider">Risk: </span>
            {pick.key_risks}
          </p>
        )}
      </div>
    </div>
  );
};

const Metric = ({ icon, label, value, color }) => (
  <div className="bento" style={{ padding: "0.625rem 0.75rem" }}>
    <div className="flex items-center gap-1.5 mb-0.5">
      {icon}
      <p className="label-overline">{label}</p>
    </div>
    <p
      className="font-display text-[14px] tabular-nums"
      style={{ color: color || "var(--text-primary)" }}
    >
      {value}
    </p>
  </div>
);
