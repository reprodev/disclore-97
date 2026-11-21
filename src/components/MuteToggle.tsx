import { useEffect, useState } from 'react';
import { isMuted, subscribeMuted, toggleMuted } from '../audio/audio';
import { BevelButton } from './BevelButton';

/** Global mute control. State lives in the audio module (unmuted at start, not persisted). */
export function MuteToggle() {
  const [muted, setMuted] = useState<boolean>(isMuted());

  useEffect(() => {
    setMuted(isMuted());
    return subscribeMuted(setMuted);
  }, []);

  return (
    <BevelButton aria-pressed={muted} onClick={() => toggleMuted()}>
      {muted ? 'Sound: Off' : 'Sound: On'}
    </BevelButton>
  );
}
