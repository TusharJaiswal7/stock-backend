import { Warning } from "@phosphor-icons/react";

export const DisclaimerBanner = () => (
  <div
    data-testid="sebi-disclaimer"
    className="px-5 py-4 mt-6 rounded-2xl border flex gap-3 items-start"
    style={{
      background: "rgba(212, 139, 62, 0.08)",
      borderColor: "rgba(212, 139, 62, 0.25)",
    }}
  >
    <Warning size={18} weight="fill" color="#D48B3E" className="mt-0.5 flex-shrink-0" />
    <p
      className="text-[10.5px] leading-relaxed tracking-wider"
      style={{ color: "#7a5a2e" }}
    >
      <span className="font-bold uppercase">For educational purposes only · Not SEBI registered.</span>{" "}
      Stock recommendations are AI-generated using a swing-trading persona. Markets carry risk. Do
      your own research and consult a SEBI-registered advisor before any investment decision.
    </p>
  </div>
);
