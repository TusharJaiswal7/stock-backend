import { useState } from "react";
import "@/App.css";
import { Toaster } from "@/components/ui/sonner";
import { TodayPlan } from "@/components/TodayPlan";
import { PicksPage } from "@/components/PicksPage";
import { Portfolio } from "@/components/Portfolio";
import { About } from "@/components/About";
import { BottomNav } from "@/components/BottomNav";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

function App() {
  const [tab, setTab] = useState("today");

  return (
    <div className="App min-h-screen w-full" style={{ background: "#E8E6DD" }}>
      <div className="phone-shell pb-28">
        <header className="px-4 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-base"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              SA
            </div>
            <div>
              <p
                className="font-display text-[15px] leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                Stock Advisor
              </p>
              <p
                className="text-[10px] tracking-[0.18em] uppercase font-bold mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                AI · India
              </p>
            </div>
          </div>
          <span
            className="pill"
            style={{
              background: "rgba(46, 109, 78, 0.1)",
              color: "var(--accent-buy)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent-buy)" }}
            />
            NSE · BSE
          </span>
        </header>

        <main>
          {tab === "today" && <TodayPlan />}
          {tab === "picks" && <PicksPage />}
          {tab === "portfolio" && <Portfolio />}
          {tab === "about" && <About />}
        </main>

        <div className="px-4">
          <DisclaimerBanner />
        </div>
      </div>

      <BottomNav active={tab} onChange={setTab} />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            fontFamily: "Manrope",
          },
        }}
      />
    </div>
  );
}

export default App;
