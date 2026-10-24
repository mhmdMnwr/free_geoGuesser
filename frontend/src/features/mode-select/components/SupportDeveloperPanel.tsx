import { useState } from "react"
import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"

interface SupportDeveloperPanelProps {
  onBackToPlay: () => void
}

export function SupportDeveloperPanel({ onBackToPlay }: SupportDeveloperPanelProps) {
  const [showCoffee, setShowCoffee] = useState(false)
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null)

  const copyToClipboard = (text: string, methodKey: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedMethod(methodKey)
    setTimeout(() => setCopiedMethod(null), 2200)
  }

  const PAYPAL_EMAIL = "mm.ameur@esi-sba.dz"
  const REDOTPAY_UID = "1061440746"
  const BARIDIMOB_RIP = "00799999004011905365"

  return (
    <div className="menu-stage-panel panel">
      <div className="menu-stage-header">
        <span className="section-index">/ DEVELOPER &amp; COMMUNITY</span>
        <h2 className="menu-stage-title">SUPPORT DEVELOPER</h2>
      </div>

      <div className="flex flex-col gap-3 my-4">
        {/* 1. GITHUB */}
        <a
          className="support-action-card"
          href="https://github.com/mhmdMnwr"
          rel="noreferrer"
          target="_blank"
        >
          <span className="support-action-icon text-amber-400 border-amber-400/40 bg-amber-400/10">
            <Icon name="crown" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-sm font-bold tracking-wider uppercase text-white">
              GITHUB // @mhmdMnwr
            </strong>
            <span className="text-xs text-slate-400 block truncate">
              Star the repository &amp; explore source code
            </span>
          </div>
          <Icon name="arrow" size={18} />
        </a>

        {/* 2. LINKEDIN */}
        <a
          className="support-action-card"
          href="https://www.linkedin.com/in/mohammed-menouer-ameur-a0448a334"
          rel="noreferrer"
          target="_blank"
        >
          <span className="support-action-icon text-sky-400 border-sky-400/40 bg-sky-400/10">
            <Icon name="network" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-sm font-bold tracking-wider uppercase text-white">
              LINKEDIN // MOHAMMED MENOUER AMEUR
            </strong>
            <span className="text-xs text-slate-400 block truncate">
              Connect for collaborations &amp; opportunities
            </span>
          </div>
          <Icon name="arrow" size={18} />
        </a>

        {/* 3. BUY ME A COFFEE (Click expands the 3 payment methods) */}
        <button
          className={`support-action-card text-left cursor-pointer transition-all ${
            showCoffee ? "border-amber-400/80 bg-amber-950/20" : ""
          }`}
          onClick={() => setShowCoffee(!showCoffee)}
          type="button"
        >
          <span className="support-action-icon text-amber-400 border-amber-400/40 bg-amber-400/10 text-xl">
            ☕
          </span>
          <div className="flex-1 min-w-0">
            <strong className="block text-sm font-bold tracking-wider uppercase text-white">
              BUY ME A COFFEE
            </strong>
            <span className="text-xs text-slate-400 block truncate">
              {showCoffee ? "Select payment channel below" : "PayPal, RedotPay, or BaridiMob (Algérie Poste)"}
            </span>
          </div>
          <span className={`text-amber-400 text-sm font-bold transition-transform duration-200 ${showCoffee ? "rotate-90" : ""}`}>
            ▶
          </span>
        </button>

        {/* 3 Payment Methods (Inline Previous Design) */}
        {showCoffee && (
          <div className="flex flex-col gap-2.5 mt-1 pl-2 sm:pl-3 border-l-2 border-amber-400/40 animate-in fade-in duration-200">
            {/* PAYPAL */}
            <div
              className="support-action-card cursor-pointer hover:border-sky-400/60 transition-colors"
              onClick={() => copyToClipboard(PAYPAL_EMAIL, "paypal")}
              title="Click to copy PayPal email"
            >
              <span className="support-action-icon text-sky-400 border-sky-400/40 bg-sky-400/10">
                <Icon name="globe" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <strong className="block text-sm font-bold tracking-wider uppercase text-white">
                  PAYPAL // {PAYPAL_EMAIL}
                </strong>
                <span className={`text-xs block truncate ${copiedMethod === "paypal" ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                  {copiedMethod === "paypal"
                    ? "✓ EMAIL COPIED TO CLIPBOARD!"
                    : "Send via PayPal app (Click to copy email)"}
                </span>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300 shrink-0">
                {copiedMethod === "paypal" ? "✓ COPIED" : "COPY EMAIL"}
              </span>
            </div>

            {/* REDOTPAY */}
            <div
              className="support-action-card cursor-pointer hover:border-rose-400/60 transition-colors"
              onClick={() => copyToClipboard(REDOTPAY_UID, "redot")}
              title="Click to copy RedotPay UID"
            >
              <span className="support-action-icon text-rose-400 border-rose-400/40 bg-rose-400/10">
                <Icon name="shield" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <strong className="block text-sm font-bold tracking-wider uppercase text-white">
                  REDOTPAY // UID: {REDOTPAY_UID}
                </strong>
                <span className={`text-xs block truncate ${copiedMethod === "redot" ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                  {copiedMethod === "redot"
                    ? "✓ REDOTPAY UID COPIED TO CLIPBOARD!"
                    : "0% fee transfer inside RedotPay App (Click to copy UID)"}
                </span>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 shrink-0">
                {copiedMethod === "redot" ? "✓ COPIED" : "COPY UID"}
              </span>
            </div>

            {/* BARIDIMOB / CCP */}
            <div
              className="support-action-card cursor-pointer hover:border-emerald-400/60 transition-colors"
              onClick={() => copyToClipboard(BARIDIMOB_RIP, "ccp")}
              title="Click to copy BaridiMob RIP"
            >
              <span className="support-action-icon text-emerald-400 border-emerald-400/40 bg-emerald-400/10">
                <Icon name="check" size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <strong className="block text-sm font-bold tracking-wider uppercase text-white">
                  BARIDIMOB / CCP // ALGÉRIE POSTE
                </strong>
                <span className={`text-xs font-mono block truncate ${copiedMethod === "ccp" ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                  {copiedMethod === "ccp"
                    ? "✓ RIP COPIED TO CLIPBOARD!"
                    : `RIP: ${BARIDIMOB_RIP} (Click to copy)`}
                </span>
              </div>
              <span className="text-xs font-mono uppercase px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shrink-0">
                {copiedMethod === "ccp" ? "✓ COPIED" : "COPY RIP"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-5 pt-3 border-t border-slate-800">
        <GameButton icon="play" onClick={onBackToPlay} variant="primary">
          BACK TO PLAY
        </GameButton>
      </div>
    </div>
  )
}

export default SupportDeveloperPanel
