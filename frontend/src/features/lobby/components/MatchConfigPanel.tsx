import { Icon } from "../../../shared/components/Icon"
import { LeafletMapView } from "../../game/components/LeafletMapView"
import {
  REGION_POOL,
  DIFFICULTY_POOL,
  DURATION_POOL,
  ROUND_POOL,
  CAPACITY_POOL,
} from "./matchConfigOptions"

interface MatchConfigPanelProps {
  isHost: boolean
  selectedRegion: string
  selectedDifficulty?: string
  selectedDuration: number
  selectedRounds: number
  maxPlayers: number
  onRegionChange: (region: string) => void
  onDifficultyChange?: (difficulty: string) => void
  onDurationChange: (duration: number) => void
  onRoundsChange: (rounds: number) => void
  onMaxPlayersChange: (maxPlayers: number) => void
}

export function MatchConfigPanel({
  isHost,
  selectedRegion,
  selectedDifficulty = "all",
  selectedDuration,
  selectedRounds,
  maxPlayers,
  onRegionChange,
  onDifficultyChange,
  onDurationChange,
  onRoundsChange,
  onMaxPlayersChange,
}: MatchConfigPanelProps) {
  return (
    <aside className="panel setup-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-label">
            <Icon name="settings" />
            MATCH CONFIG
          </div>
          <span className="panel-caption">
            {isHost ? "CONFIGURED BY YOU (SQUAD LEADER)" : "CONFIGURED BY LEADER 👑"}
          </span>
        </div>
        <Icon name="shield" />
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="map" size={17} /> REGION POOL</span>
        <div className="option-stack">
          {REGION_POOL.map((o) => (
            <button
              className={selectedRegion === o.id ? "active" : ""}
              disabled={!isHost} key={o.id} onClick={() => onRegionChange(o.id)} type="button"
            >
              <span>{o.label}</span>
              <i>{selectedRegion === o.id ? "ACTIVE" : ""}</i>
            </button>
          ))}
        </div>
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="shield" size={17} /> DIFFICULTY TIER</span>
        <div className="timer-options">
          {DIFFICULTY_POOL.map((o) => (
            <button
              className={selectedDifficulty === o.id ? "active" : ""}
              disabled={!isHost} key={o.id} onClick={() => onDifficultyChange?.(o.id)} type="button"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="clock" size={17} /> FIRST GUESS TIMER</span>
        <div className="timer-options">
          {DURATION_POOL.map((sec) => (
            <button
              className={selectedDuration === sec ? "active" : ""}
              disabled={!isHost} key={sec} onClick={() => onDurationChange(sec)} type="button"
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="radar" size={17} /> ROUND COUNT</span>
        <div className="timer-options">
          {ROUND_POOL.map((rnd) => (
            <button
              className={selectedRounds === rnd ? "active" : ""}
              disabled={!isHost} key={rnd} onClick={() => onRoundsChange(rnd)} type="button"
            >
              {rnd} RNDS
            </button>
          ))}
        </div>
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="players" size={17} /> MAX OPERATIVES</span>
        <div className="timer-options">
          {CAPACITY_POOL.map((cap) => (
            <button
              className={maxPlayers === cap ? "active" : ""}
              disabled={!isHost} key={cap} onClick={() => onMaxPlayersChange(cap)} type="button"
            >
              {cap} OPS
            </button>
          ))}
        </div>
      </div>

      <div className="config-block">
        <span className="config-label"><Icon name="map" size={17} /> EXPEDITION WORLD ATLAS</span>
        <div className="lobby-map-preview rounded-lg overflow-hidden border border-slate-700/60" style={{ height: "180px", minHeight: "180px", width: "100%", position: "relative" }}>
          <LeafletMapView interactive={false} pin={null} zoom={1} />
        </div>
      </div>
    </aside>
  )
}

export default MatchConfigPanel
