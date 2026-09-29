import { useState, type FormEvent } from 'react';
import { claimNick, recoverNick } from '../api';
import { NICK_MAX_LENGTH, suggestedNick, tokenFor, type Identity } from '../nick';

interface Props {
  /** Convite pendente: depois de escolher o nick, o jogador entra direto nessa sala. */
  inviteCode: string;
  /** Motivo de ter voltado para cá (ex: o nick deixou de ser deste navegador). */
  reason: string | null;
  onDone: (identity: Identity) => void;
}

type Step = { kind: 'choose' } | { kind: 'taken'; name: string };

/**
 * Primeira tela do jogo: escolher o nick. O primeiro navegador que usa um nick fica com ele.
 * Para usar o mesmo nick em outro aparelho, o dono gera um código em "Sincronizar dispositivo" (na home)
 * e digita aqui, no passo de nick que já tem dono.
 */
export default function NickScreen({ inviteCode, reason, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [nick, setNick] = useState(suggestedNick);
  const [syncCode, setSyncCode] = useState('');
  const [error, setError] = useState<string | null>(reason);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError('Sem conexão com o servidor. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const onChoose = (e: FormEvent) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name) return;
    void run(async () => {
      const result = await claimNick(name, tokenFor(name));
      if (result.ok) onDone({ name: result.name, token: result.token });
      else if (result.taken) setStep({ kind: 'taken', name });
      else setError(result.error);
    });
  };

  const onSync = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'taken' || !syncCode.trim()) return;
    void run(async () => {
      try {
        onDone(await recoverNick(step.name, syncCode));
      } catch (err) {
        if (err instanceof TypeError) throw err;
        setError('Código de sincronização inválido');
      }
    });
  };

  if (step.kind === 'taken') {
    return (
      <section className="panel nick-screen">
        <p className="score-label">Esse nick já tem dono</p>
        <p className="nick-screen-text">
          Se <strong>{step.name}</strong> é seu, abra o jogo no dispositivo onde você já usa esse nick, toque em{' '}
          <strong>Sincronizar dispositivo</strong> e digite o código aqui.
        </p>
        <form className="nick-screen-form" onSubmit={onSync}>
          <input
            value={syncCode}
            onChange={(e) => setSyncCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            aria-label="Código de sincronização"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <button className="btn btn-primary" disabled={busy || !syncCode.trim()}>
            {busy ? 'Verificando...' : 'Sincronizar'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <button
          className="link-button"
          onClick={() => {
            setStep({ kind: 'choose' });
            setError(null);
          }}
        >
          Escolher outro nick
        </button>
      </section>
    );
  }

  return (
    <section className="panel nick-screen">
      {inviteCode && (
        <p className="nick-screen-invite">
          Você foi convidado para a sala <strong>{inviteCode}</strong>
        </p>
      )}
      <form className="nick-screen-form" onSubmit={onChoose}>
        <label className="nick-label" htmlFor="nick">
          Escolha seu nick
        </label>
        <input
          id="nick"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={NICK_MAX_LENGTH}
          autoComplete="nickname"
          spellCheck={false}
          autoFocus
          disabled={busy}
        />
        <button className="btn btn-primary btn-lg" disabled={busy || !nick.trim()}>
          {busy ? 'Verificando...' : inviteCode ? 'Entrar na sala' : 'Continuar'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="nick-screen-hint">Já joga em outro dispositivo? Digite o mesmo nick para sincronizar.</p>
    </section>
  );
}
