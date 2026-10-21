import React from "react"
import { Icon } from "./Icon"
import type { IconName } from "./Icon"

export function GameButton({
  children,
  className = "",
  icon,
  onClick,
  disabled = false,
  variant = "primary",
  style,
}: {
  children: React.ReactNode
  className?: string
  icon?: IconName
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "ghost" | "outline"
  style?: React.CSSProperties
}) {
  return (
    <button
      className={`game-button game-button--${variant} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
      type="button"
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  )
}
