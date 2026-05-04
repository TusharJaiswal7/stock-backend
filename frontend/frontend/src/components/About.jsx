import { CheckCircle, Phone, Cloud, BookmarkSimple, Pencil } from "@phosphor-icons/react";

const Step = ({ n, title, desc }) => (
  <div className="flex gap-3 items-start">
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center font-display text-[13px] flex-shrink-0"
      style={{ background: "var(--primary)", color: "#fff" }}
    >
      {n}
    </div>
    <div className="flex-1">
      <p className="font-display text-[14px]" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: "var(--text-secondary)" }}>
        {desc}
      </p>
    </div>
  </div>
);

export const About = () => (
  <div data-testid="about-page" className="px-4 pt-4 space-y-4 pb-4">
    <div>
      <h1 className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>
        About
      </h1>
      <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
        A 100% phone-first AI swing-trade advisor for Indian markets.
      </p>
    </div>

    <div className="bento">
      <p className="label-overline mb-2">AI Persona</p>
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
        25-year veteran Indian stock market expert. Conservative. Capital protection first.
        Delivery-only swing trader. No penny-stock traps.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          "Capital safety first",
          "Delivery-only trades",
          "Tight stop losses",
          "Phased entries",
        ].map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <CheckCircle size={14} weight="fill" color="var(--accent-buy)" />
            <span className="text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
              {p}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Netlify Deploy guide */}
    <div className="bento">
      <div className="flex items-center gap-2 mb-3">
        <Cloud size={18} weight="fill" color="var(--primary)" />
        <p className="font-display text-[16px]" style={{ color: "var(--text-primary)" }}>
          Deploy free on Netlify (from your phone)
        </p>
      </div>
      <div className="space-y-3">
        <Step
          n="1"
          title="Push code to GitHub mobile app"
          desc="Open emergent → Profile → Push to GitHub. Sign in to GitHub on phone, accept the new repo."
        />
        <Step
          n="2"
          title="Open netlify.com in mobile browser"
          desc="Tap 'Sign up' → continue with GitHub. Authorise Netlify to read your repos."
        />
        <Step
          n="3"
          title="Add new site → Import from GitHub"
          desc="Pick the stock-advisor repo. Build command: yarn build · Publish dir: build · Base: frontend."
        />
        <Step
          n="4"
          title="Add env variable"
          desc="Site settings → Environment → REACT_APP_BACKEND_URL = your Emergent backend URL."
        />
        <Step
          n="5"
          title="Deploy"
          desc="Tap Deploy. In ~2 min you get a free URL like stock-advisor.netlify.app."
        />
      </div>
    </div>

    {/* How to update / open / pin */}
    <div className="bento">
      <div className="flex items-center gap-2 mb-3">
        <Phone size={18} weight="fill" color="var(--primary)" />
        <p className="font-display text-[16px]" style={{ color: "var(--text-primary)" }}>
          Phone tips
        </p>
      </div>
      <div className="space-y-3">
        <Step
          n="A"
          title="Open the app any time"
          desc="Type your-app.netlify.app in Chrome. Bookmark it for one-tap access."
        />
        <Step
          n="B"
          title="Pin to home screen (works like a real app)"
          desc="Chrome → ⋮ menu → 'Add to Home Screen'. A real app icon appears on your home."
        />
        <Step
          n="C"
          title="Edit later from phone"
          desc="Re-open emergent on phone, ask for changes, push to GitHub. Netlify rebuilds automatically."
        />
      </div>
    </div>

    {/* Live data plug-in */}
    <div className="bento">
      <div className="flex items-center gap-2 mb-3">
        <Pencil size={18} weight="fill" color="var(--primary)" />
        <p className="font-display text-[16px]" style={{ color: "var(--text-primary)" }}>
          Plug live NSE prices later
        </p>
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        All entries / exits are AI estimates today. To switch the stock card and Today's
        Plan to <span className="font-bold">live prices</span>, add a free stock data
        provider key to <code className="bg-[#F0EFEB] px-1 rounded">backend/.env</code>:
      </p>
      <div
        className="rounded-xl p-3 mt-2 font-mono text-[11px]"
        style={{ background: "#1C211F", color: "#A8D8B5" }}
      >
        <div>STOCK_API_PROVIDER=yfinance</div>
        <div className="opacity-60"># or alpha_vantage / twelve_data</div>
        <div>STOCK_API_KEY=your_free_key</div>
      </div>
      <p className="text-[11px] leading-relaxed mt-2" style={{ color: "var(--text-tertiary)" }}>
        Cards then auto-show <span className="font-bold" style={{ color: "var(--accent-buy)" }}>● Live</span> instead of <span className="font-bold" style={{ color: "var(--accent-hold)" }}>AI Est.</span>
      </p>
    </div>

    {/* SEBI disclaimer (full) */}
    <div
      className="rounded-2xl p-4 border"
      style={{
        background: "rgba(183, 92, 70, 0.06)",
        borderColor: "rgba(183, 92, 70, 0.2)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <BookmarkSimple size={16} weight="fill" color="var(--accent-sell)" />
        <p className="label-overline" style={{ color: "var(--accent-sell)" }}>
          SEBI Disclaimer
        </p>
      </div>
      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This app is for <span className="font-bold uppercase">educational purposes only</span>{" "}
        and is <span className="font-bold uppercase">not registered with SEBI</span> as an
        investment adviser. All recommendations are AI-generated based on a swing-trader persona
        and are not personalised investment advice. Stock markets carry risk of capital loss.
        Always do your own research and consult a SEBI-registered advisor before any investment.
      </p>
    </div>

    <p className="text-center text-[10px] tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
      Stock Advisor AI India · v1.0
    </p>
  </div>
);
