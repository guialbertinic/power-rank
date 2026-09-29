import { useState, type FormEvent } from 'react';
import { submitScore } from '../api';

const NAME_KEY = 'power-rank:name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // localStorage indisponível (modo privado etc.): só não lembra o nome.
  }
}

interface Props {
  gameId: string;
  placements: string[];
  onSubmitted: (name: string) => void;
}

export default function SubmitScore({ gameId, placements, onSubmitted }: Props) {
  const [name, setName] = useState(loadName);
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [rank, setRank] = useState<number | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setStatus('sending');
    try {
      const result = await submitScore(gameId, trimmed, placements);
      saveName(trimmed);
      setRank(result.rank);
      onSubmitted(trimmed);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    }
  };

  if (rank !== null) {
    return <p className="submit-done">Pontuação enviada! Você está em #{rank} no ranking global.</p>;
  }

  return (
    <form className="submit-score" onSubmit={onSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Seu nome"
        maxLength={20}
        aria-label="Seu nome"
        disabled={status === 'sending'}
      />
      <button className="btn-secondary" disabled={status === 'sending' || !name.trim()}>
        {status === 'sending' ? 'Enviando...' : 'Enviar pro ranking'}
      </button>
      {status === 'error' && <p className="error">{error}</p>}
    </form>
  );
}
