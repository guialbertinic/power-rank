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

type Step =
  | { kind: 'choose' }
  | { kind: 'taken'; name: string }
  | { kind: 'code'; identity: Identity; recoveryCode: string };

/**
 * Primeira tela do jogo: escolher o nick. O primeiro navegador que usa um nick fica com ele; em outro
 * aparelho, o dono usa o código de recuperação mostrado aqui na primeira vez.
 */
export default function NickScreen({ inviteCode, reason, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [nick, setNick] = useState(suggestedNick);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(reason);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
      if (!result.ok) {
        if (result.taken) setStep({ kind: 'taken', name });
        else setError(result.error);
        return;
      }
      const identity = { name: result.name, token: result.token };
      if (result.recoveryCode) setStep({ kind: 'code', identity, recoveryCode: result.recoveryCode });
      else onDone(identity);
    });
  };

  const onRecover = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'taken' || !recoveryCode.trim()) return;
    void run(async () => {
      try {
        onDone(await recoverNick(step.name, recoveryCode));
      } catch (err) {
        if (err instanceof TypeError) throw err;
        setError('Código de recuperação inválido');
      }
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Sem permissão de clipboard: o código continua visível para copiar à mão.
    }
  };

  if (step.kind === 'code') {
    return (
      <section className="panel nick-screen">
        <p className="score-label">O nick {step.identity.name} agora é seu</p>
        <p className="nick-screen-text">
          Guarde este código. Ele é o único jeito de usar o seu nick em outro navegador ou aparelho.
        </p>
        <p className="recovery-code">{step.recoveryCode}</p>
        <button className="link-button" onClick={() => copyCode(step.recoveryCode)}>
          {copied ? 'Copiado!' : 'Copiar código'}
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => onDone(step.identity)}>
          {inviteCode ? 'Entrar na sala' : 'Continuar'}
        </button>
      </section>
    );
  }

  if (step.kind === 'taken') {
    return (
      <section className="panel nick-screen">
        <p className="score-label">Esse nick já tem dono</p>
        <p className="nick-screen-text">
          Se <strong>{step.name}</strong> é seu, digite o código de recuperação que apareceu quando você escolheu o nick.
        </p>
        <form className="nick-screen-form" onSubmit={onRecover}>
          <input
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            aria-label="Código de recuperação"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <button className="btn btn-primary" disabled={busy || !recoveryCode.trim()}>
            {busy ? 'Verificando...' : 'Recuperar'}
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
    </section>
  );
}
