import { Icon } from "../../../shared/components/Icon"

interface BrowserHeaderProps {
  username: string
  onBack: () => void
  onUsernameChange?: (name: string) => void
}

export default function BrowserHeader({
  username,
  onBack,
  onUsernameChange,
}: BrowserHeaderProps) {
  return (
    <header className="mobile-native-nav">
      <button
        aria-label="Back to Main Menu"
        className="mobile-back-btn"
        onClick={onBack}
        type="button"
      >
        <Icon name="back" size={18} />
        <span className="hidden sm:inline">MENU</span>
      </button>

      <span className="mobile-nav-title">ACTIVE SQUADS</span>

      <label className="mobile-codename-chip" title="Click to edit your codename">
        <span className="mobile-dot" />
        <input
          aria-label="Operative Codename"
          className="mobile-codename-input"
          maxLength={18}
          onChange={(e) => onUsernameChange?.(e.target.value)}
          placeholder="CODENAME"
          title="Click to edit your codename"
          type="text"
          value={username}
        />
      </label>
    </header>
  )
}
