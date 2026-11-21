import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import '../styles/tooltip.css';

export interface TooltipProps {
  text: string;
  children: ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
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
      <span id={id} role="tooltip" className="tooltip-bubble" hidden={!visible}>
        {text}
      </span>
    </span>
  );
}
