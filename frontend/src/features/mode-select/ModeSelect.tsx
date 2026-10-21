import "./mode-select.css"
import { EffectsLayer } from "../../shared/components/EffectsLayer"
import { Icon } from "../../shared/components/Icon"
import { GameButton } from "../../shared/components/GameButton"
import type { ConnectionMode } from "../../types/game"

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
  mode,
  setMode,
  onContinue,
  username,
  setUsername,
  usernameError,
  isCheckingUsername = false,
}: ModeSelectProps) {
  return (
    <main className={`entry-screen ${isLaunching ? "entry-screen--launching" : ""}`}>
      <EffectsLayer />
      <div className="ambient-grid" />
      <div className="entry-header">
        <div className="logo" style={{ marginLeft: "auto" }}>
          <span className="logo-icon">
            <Icon name="researcher" size={26} />
          </span>
          <span>THEgeoguesser</span>
        </div>
      </div>

      <section className="entry-content">
        <div className="entry-title" data-text="YOU MUST SEARCH FOR INTERNSHIP WHAT ARE YOU DOING!!!">
          YOU MUST SEARCH FOR INTERNSHIP WHAT ARE YOU DOING!!!
        </div>

        {/* Operative Codename Input */}
        <div className="mt-8 mb-6 max-w-md w-full">
          <label className="block text-xs font-mono uppercase text-sky-400 mb-2 tracking-widest">
            CODENAME
          </label>
          <input
            className={`w-full bg-slate-900/90 border ${
              usernameError ? "border-rose-500 focus:border-rose-400" : "border-slate-700 focus:border-sky-400"
            } rounded-lg px-4 py-3 text-slate-100 font-mono text-sm tracking-wider uppercase outline-none transition shadow-inner`}
            maxLength={18}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && username.trim() && !isCheckingUsername) {
                onContinue()
              }
            }}
            placeholder="ENTER YOUR CODENAME..."
            type="text"
            value={username}
          />
          {usernameError && (
            <div className="mt-2.5 p-2.5 text-xs font-mono text-rose-400 bg-rose-950/80 border border-rose-800 rounded flex items-center gap-2">
              <span>⚠</span>
              <span>{usernameError}</span>
            </div>
          )}
        </div>

        <div className="mode-grid">
          <button
            className={`mode-card ${mode === "lan" ? "mode-card--active" : ""}`}
            onClick={() => setMode("lan")}
            type="button"
          >
            <span className="mode-number">01</span>
            <span className="mode-icon mode-icon--lan">
              <Icon name="lan" size={34} />
            </span>
            <span className="mode-content">
              <strong>MULTIPLAYER LOBBY</strong>
              <small>Host or join match rooms with other operatives.</small>
            </span>
            <span className="mode-select">
              {mode === "lan" && <Icon name="check" size={18} />}
            </span>
          </button>

          <button
            className={`mode-card ${mode === "web" ? "mode-card--active" : ""}`}
            onClick={() => setMode("web")}
            type="button"
          >
            <span className="mode-number">02</span>
            <span className="mode-icon">
              <Icon name="globe" size={34} />
            </span>
            <span className="mode-content">
              <strong>DIRECT LINK</strong>
              <small>Connect directly via host IP address.</small>
            </span>
            <span className="mode-select">
              {mode === "web" && <Icon name="check" size={18} />}
            </span>
          </button>
        </div>

        <GameButton
          className="continue-button"
          disabled={!username.trim() || isCheckingUsername}
          icon="arrow"
          onClick={onContinue}
        >
          {isLaunching
            ? "ESTABLISHING UPLINK..."
            : isCheckingUsername
              ? "VERIFYING CODENAME..."
              : username.trim()
                ? "ENTER SQUAD BROWSER"
                : "ENTER CODENAME TO PROCEED"}
        </GameButton>
      </section>
    </main>
  )
}
