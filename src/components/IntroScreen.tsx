import type { FormEvent } from 'react';
import { NICK_MAX_LENGTH } from '../nick';
import Leaderboard from './Leaderboard';

interface Props {
  nick: string;
  onNickChange: (nick: string) => void;
  starting: boolean;
  onStart: () => void;
}

export default function IntroScreen({ nick, onNickChange, starting, onStart }: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (nick.trim()) onStart();
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
        <button className="btn btn-primary btn-lg" disabled={starting || !nick.trim()}>
          {starting ? 'Sorteando...' : 'Começar'}
        </button>
      </form>
      <Leaderboard highlight={nick} />
    </div>
  );
}
