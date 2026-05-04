import { House, ChartLineUp, Briefcase, Info } from "@phosphor-icons/react";

const tabs = [
  { id: "today", label: "Today", icon: House },
  { id: "picks", label: "Picks", icon: ChartLineUp },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "about", label: "About", icon: Info },
];

export const BottomNav = ({ active, onChange }) => {
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      <div
        className="pointer-events-auto w-full"
        style={{ maxWidth: "28rem" }}
      >
        <div
          className="glass border-t flex justify-around items-center pt-3 pb-5"
          style={{ borderColor: "var(--border)" }}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                data-testid={`nav-${t.id}`}
                onClick={() => onChange(t.id)}
                className="flex flex-col items-center gap-1 px-3 transition-transform active:scale-95"
              >
                <Icon
                  size={24}
                  weight={isActive ? "fill" : "regular"}
                  color={isActive ? "var(--primary)" : "var(--text-tertiary)"}
                />
                <span
                  className="text-[10px] font-bold tracking-wider"
                  style={{
                    color: isActive ? "var(--primary)" : "var(--text-tertiary)",
                  }}
                >
                  {t.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
