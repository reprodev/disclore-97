import { useEffect, useState } from 'react';
import { isAmbienceOn, stopAmbience, subscribeAmbience, toggleAmbience } from '../audio/audio';
import { BevelButton } from './BevelButton';

/**
 * Ambient soundscape control. Off by default. The soundscape is silent while Sound is muted,
 * and it stops when this control leaves the screen.
 */
export function AmbienceToggle() {
  const [on, setOn] = useState<boolean>(isAmbienceOn());

  useEffect(() => {
    setOn(isAmbienceOn());
    const unsubscribe = subscribeAmbience(setOn);
    return () => {
      unsubscribe();
      stopAmbience();
    };
  }, []);

  return (
    <BevelButton
      className="mute-toggle ambience-toggle"
      aria-pressed={on}
      title="Ambient soundscape for the open disc"
      onClick={() => toggleAmbience()}
    >
      <span>{on ? 'Ambience: On' : 'Ambience: Off'}</span>
    </BevelButton>
  );
}
