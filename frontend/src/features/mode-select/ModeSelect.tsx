import { useState } from "react"
import "./mode-select.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { FeedbackPanel } from "./components/FeedbackPanel"
import { SupportDeveloperPanel } from "./components/SupportDeveloperPanel"
import type { ConnectionMode } from "../../types/game"

type MenuModal = "feedback" | "support" | null

interface ModeSelectProps {
  isLaunching: boolean
  mode: ConnectionMode | null
  setMode: (mode: ConnectionMode) => void
  onContinue: () => void
  username: string
  setUsername: (name: string) => void
  usernameError?: string | null
  isCheckingUsername?: boolean
}

export function ModeSelect({
  isLaunching,
  onContinue,
  username,
  setUsername,
  usernameError,
  isCheckingUsername = false,
}: ModeSelectProps) {
  const [activeModal, setActiveModal] = useState<MenuModal>(null)

  const handlePlayClick = () => {
    if (isCheckingUsername) return
    if (!username.trim()) {
      setUsername("OPERATIVE-" + Math.floor(10 + Math.random() * 90))
    }
    onContinue()
  }

  return (
    <main className={`entry-screen ${isLaunching ? "entry-screen--launching" : ""}`}>
      <EffectsLayer />
      <div className="ambient-grid" />

      <header className="entry-header">
        <div className="logo">
          <span className="logo-icon">
            <Icon name="researcher" size={26} />
          </span>
          <span>guessiha</span>
        </div>
        <label className="entry-operative-pill" title="Click to change your codename">
          <span className="entry-status-dot" />
          <span className="text-slate-400">CODENAME:</span>
          <input
            aria-label="Operative Codename"
            className="bg-transparent text-sky-400 font-bold uppercase tracking-wider outline-none w-32 sm:w-40 border-b border-transparent focus:border-sky-400 transition-colors"
            maxLength={18}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ENTER CODENAME"
            type="text"
            value={username}
          />
        </label>
      </header>

      <section className="entry-content">
        <div className="main-menu-left">
          <h1 className="entry-title" data-text="guessiha">
            guessiha
          </h1>
          <p className="entry-subtitle">
            Drop into unknown roads worldwide. Read the terrain, lock your coordinates, and outscore your squad in real time.
          </p>

          {usernameError && (
            <div className="mt-4 p-3 bg-rose-950/90 border border-rose-500 rounded-lg text-rose-300 text-xs font-mono">
              ⚠ {usernameError}
            </div>
          )}

          <nav aria-label="Game Main Menu" className="main-menu-nav">
            <button
              className="menu-blade menu-blade--active continue-button"
              disabled={isCheckingUsername}
              onClick={handlePlayClick}
              type="button"
            >
              <span className="menu-blade-icon">
                <Icon name="play" size={24} />
              </span>
              <span className="menu-blade-text">
                <strong>{isCheckingUsername ? "VERIFYING..." : "PLAY"}</strong>
                <small>ENTER SQUAD BROWSER &amp; DEPLOY INTO A MATCH</small>
              </span>
              <Icon name="arrow" size={20} />
            </button>

            <button
              className="menu-blade"
              onClick={() => setActiveModal("feedback")}
              type="button"
            >
              <span className="menu-blade-icon">
                <Icon name="message" size={24} />
              </span>
              <span className="menu-blade-text">
                <strong>FEEDBACK</strong>
                <small>REPORT BUGS, SUGGEST MAPS &amp; RATE GAMEPLAY</small>
              </span>
              <Icon name="arrow" size={20} />
            </button>

            <button
              className="menu-blade"
              onClick={() => setActiveModal("support")}
              type="button"
            >
              <span className="menu-blade-icon">
                <Icon name="heart" size={24} />
              </span>
              <span className="menu-blade-text">
                <strong>SUPPORT DEVELOPER</strong>
                <small>BACK THE PROJECT, STAR REPO &amp; SHARE WITH FRIENDS</small>
              </span>
              <Icon name="arrow" size={20} />
            </button>
          </nav>
        </div>
      </section>

      {activeModal && (
        <div className="menu-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="menu-modal-box" onClick={(e) => e.stopPropagation()}>
            {activeModal === "feedback" ? (
              <FeedbackPanel onBackToPlay={() => setActiveModal(null)} username={username} />
            ) : (
              <SupportDeveloperPanel onBackToPlay={() => setActiveModal(null)} />
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default ModeSelect
