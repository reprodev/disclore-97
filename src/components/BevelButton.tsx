import { useState } from 'react';
import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { playClick } from '../audio/audio';
import '../styles/button.css';

export type BevelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Skips the standard click sound, for buttons that play their own. */
  quiet?: boolean;
};

export function BevelButton({
  className,
  disabled,
  quiet = false,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onKeyDown,
  onKeyUp,
  onBlur,
  type = 'button',
  children,
  ...rest
}: BevelButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isPressed = pressed && !disabled;

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!quiet) playClick();
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      className={className ? `bevel-button ${className}` : 'bevel-button'}
      data-pressed={isPressed ? 'true' : 'false'}
      onClick={handleClick}
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'Enter' || e.key === ' ') setPressed(true);
        onKeyDown?.(e);
      }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => {
        setPressed(false);
        onKeyUp?.(e);
      }}
      onBlur={(e) => {
        setPressed(false);
        onBlur?.(e);
      }}
    >
      {children}
    </button>
  );
}
