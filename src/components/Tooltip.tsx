import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import '../styles/tooltip.css';

export interface TooltipProps {
  text: string;
  children: ReactNode;
  /** A richer body shown instead of the plain text, for example a title and a fact. */
  card?: ReactNode;
  /** Open the card toward the left, for pins near the right edge. */
  alignEnd?: boolean;
}

export function Tooltip({ text, children, card, alignEnd = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <span
      className="tooltip-wrap"
      aria-describedby={id}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={['tooltip-bubble', card ? 'tooltip-bubble--card' : '', alignEnd ? 'tooltip-bubble--end' : '']
          .filter(Boolean)
          .join(' ')}
        hidden={!visible}
      >
        {card ?? text}
      </span>
    </span>
  );
}
