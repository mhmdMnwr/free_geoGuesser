import React from "react"
import { Icon, type IconName } from "./Icon"

export interface GameButtonProps {
  children: React.ReactNode
  className?: string
  icon?: IconName
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  variant?: "primary" | "ghost" | "outline"
  style?: React.CSSProperties
  title?: string
}

export function GameButton({
  children,
  className = "",
  icon,
  onClick,
  disabled = false,
  variant = "primary",
  style,
  title,
}: GameButtonProps) {
  const isTrailingIcon = icon === "arrow"

  return (
    <button
      className={`game-button game-button--${variant} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      disabled={disabled}
      onClick={onClick}
      style={style}
      title={title}
      type="button"
    >
      {icon && !isTrailingIcon && <Icon name={icon} />}
      <span>{children}</span>
      {icon && isTrailingIcon && <Icon name={icon} />}
    </button>
  )
}

export default GameButton
