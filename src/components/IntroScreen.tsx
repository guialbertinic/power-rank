import type { FormEvent } from 'react';
import type { Mode } from '../game/modes';
import { NICK_MAX_LENGTH } from '../nick';
import Leaderboard from './Leaderboard';

interface Props {
  nick: string;
  onNickChange: (nick: string) => void;
  /** Categoria escolhida no seletor do título; o ranking abaixo acompanha. */
  mode: Mode;
  canStart: boolean;
  starting: boolean;
  onStart: () => void;
}

export default function IntroScreen({ nick, onNickChange, mode, canStart, starting, onStart }: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nick.trim() && canStart) onStart();
  };

  return (
    <div className="intro">
      <form className="nick-form" onSubmit={onSubmit}>
        <label className="nick-label" htmlFor="nick">
          Seu nick
        </label>
        <input
          id="nick"
          value={nick}
          onChange={(e) => onNickChange(e.target.value)}
          maxLength={NICK_MAX_LENGTH}
          autoComplete="nickname"
          spellCheck={false}
          disabled={starting}
        />
        <button className="btn btn-primary btn-lg" disabled={starting || !nick.trim() || !canStart}>
          {starting ? 'Sorteando...' : 'Começar'}
        </button>
      </form>
      <Leaderboard mode={mode} highlight={nick} />
    </div>
  );
}
