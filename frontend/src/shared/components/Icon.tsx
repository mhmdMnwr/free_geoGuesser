import React from "react"

export type IconName =
  | "arrow"
  | "back"
  | "chart"
  | "check"
  | "clock"
  | "copy"
  | "crown"
  | "globe"
  | "heart"
  | "network"
  | "map"
  | "message"
  | "play"
  | "players"
  | "plus"
  | "radar"
  | "researcher"
  | "settings"
  | "shield"

const iconPaths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  copy: (
    <>
      <rect height="10" rx="2" width="10" x="8" y="8" />
      <path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  crown: <path d="M3 18h18l-2-11-5 5-2-7-2 7-5-5-2 11Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" />
    </>
  ),
  heart: (
    <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 5.6a5 5 0 0 1 7.5 7Z" />
  ),
  network: (
    <>
      <rect height="6" rx="1" width="8" x="8" y="3" />
      <rect height="6" rx="1" width="7" x="3" y="15" />
      <rect height="6" rx="1" width="7" x="14" y="15" />
      <path d="M12 9v3M6.5 15v-3h11v3" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  message: (
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
  ),
  play: <path d="m6 4 14 8-14 8V4Z" />,
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-2.2A4.8 4.8 0 0 1 8.3 12h1.4a4.8 4.8 0 0 1 4.8 4.8V19M16 5.5a3 3 0 0 1 0 5.8M17 13a4.5 4.5 0 0 1 3.5 4.4V19" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="5" />
      <path d="M12 12 18.5 5.5M12 3v2M21 12h-2M12 21v-2M3 12h2" />
    </>
  ),
  researcher: (
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5Z" />
      <path d="M5 9.5v5.5c0 2 3.1 3.5 7 3.5s7-1.5 7-3.5V9.5" />
      <path d="M20 9v5" />
      <circle cx="16" cy="16" r="4" />
      <path d="m19 19 3 3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  shield: <path d="M12 3 4.5 6v5.2c0 4.6 3.2 8.2 7.5 9.8 4.3-1.6 7.5-5.2 7.5-9.8V6L12 3Z" />,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {iconPaths[name]}
      </g>
    </svg>
  )
}

export default Icon
