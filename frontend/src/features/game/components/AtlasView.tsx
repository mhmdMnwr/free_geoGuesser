import { Icon } from "../../../shared/components/Icon"
import { GameButton } from "../../../shared/components/GameButton"
import { LeafletMapView } from "./LeafletMapView"
import { LiveStandingsWidget } from "./LiveStandingsWidget"
import type { Coordinates } from "../../../types/game"

interface AtlasViewProps {
  currentRound: number
  totalRounds: number
  totalScore: number
  liveLeaderboard: any[]
  myPin: Coordinates | null
  hasGuessed: boolean
  onSelectCoords: (coords: Coordinates) => void
  onLockGuess: () => void
  onCloseAtlas: () => void
}

export function AtlasView({
  currentRound,
  totalRounds,
  totalScore,
  liveLeaderboard,
  myPin,
  hasGuessed,
  onSelectCoords,
  onLockGuess,
  onCloseAtlas,
}: AtlasViewProps) {
  const handleLockGuess = () => {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      window.navigator.vibrate(20)
    }
    onLockGuess()
  }

  return (
    <section className="atlas-view">
      <header className="atlas-header md:hidden">
        <button
          aria-label="Back to Street View"
          className="atlas-back-btn"
          onClick={onCloseAtlas}
          type="button"
        >
          <Icon name="back" size={18} />
          <span>STREET VIEW</span>
        </button>

        <span className="atlas-pin-status">
          {hasGuessed
            ? "✓ GUESS LOCKED"
            : myPin
              ? "📍 PIN PLACED"
              : "TAP MAP TO PLACE PIN"}
        </span>
      </header>

      <div className="atlas-map-container">
        <LeafletMapView
          interactive={!hasGuessed}
          onSelectCoords={onSelectCoords}
          pin={myPin}
          zoom={3}
        />

        <div className="hidden md:block">
          <LiveStandingsWidget
            className="live-standings-widget--atlas"
            currentRound={currentRound}
            leaderboard={liveLeaderboard}
            totalRounds={totalRounds}
            totalScore={totalScore}
          />
        </div>
      </div>

      <footer className="atlas-footer">
        {hasGuessed ? (
          <div className="atlas-locked-pill">
            <span>✓ GUESS LOCKED // WAITING FOR SQUAD</span>
          </div>
        ) : (
          <GameButton
            disabled={!myPin}
            icon="check"
            onClick={handleLockGuess}
            variant="primary"
          >
            {myPin ? "CONFIRM GUESS" : "TAP MAP TO PLACE PIN"}
          </GameButton>
        )}
      </footer>
    </section>
  )
}

export default AtlasView
