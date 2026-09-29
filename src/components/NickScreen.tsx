import { useState, type FormEvent } from 'react';
import { claimNick } from '../api';
import { PASSWORD_MAX_LENGTH } from '../game/account';
import { NICK_MAX_LENGTH, suggestedNick, tokenFor, type Identity } from '../nick';

interface Props {
  /** Convite pendente: depois de escolher o nick, o jogador entra direto nessa sala. */
  inviteCode: string;
  /** Motivo de ter voltado para cá (ex: o nick deixou de ser deste navegador). */
  reason: string | null;
  onDone: (identity: Identity) => void;
}

type Step = { kind: 'choose' } | { kind: 'taken'; name: string; hasPassword: boolean };

/**
 * Primeira tela do jogo: escolher o nick, que é único. Com senha, o jogador entra com o mesmo nick em
 * qualquer dispositivo; como convidado, o nick fica só neste navegador (dá para criar a senha depois em
 * "Sincronizar dispositivo", na home).
 */
export default function NickScreen({ inviteCode, reason, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [nick, setNick] = useState(suggestedNick);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(reason);
  const [busy, setBusy] = useState(false);

  const submit = (name: string, withPassword: string | undefined) => {
    setBusy(true);
    setError(null);
    claimNick(name, tokenFor(name), withPassword)
      .then((result) => {
        if (result.ok) return onDone({ name: result.name, token: result.token });
        if (!result.taken) return setError(result.error);
        setStep({ kind: 'taken', name, hasPassword: result.hasPassword });
        setPassword('');
      })
      .catch(() => setError('Sem conexão com o servidor. Tente de novo.'))
      .finally(() => setBusy(false));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = step.kind === 'taken' ? step.name : nick.trim();
    if (name && password) submit(name, password);
  };

  const onGuest = () => {
    const name = nick.trim();
    if (name) submit(name, undefined);
  };

  const passwordInput = (label: string, autoComplete: string) => (
    <input
      type="password"
      className="nick-password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      maxLength={PASSWORD_MAX_LENGTH}
      placeholder={label}
      aria-label={label}
      autoComplete={autoComplete}
      disabled={busy}
    />
  );

  if (step.kind === 'taken') {
    const back = () => {
      setStep({ kind: 'choose' });
      setError(null);
    };
    return (
      <section className="panel nick-screen">
        <p className="score-label">Esse nick já tem dono</p>
        {step.hasPassword ? (
          <>
            <p className="nick-screen-text">
              Se <strong>{step.name}</strong> é seu, digite a senha.
            </p>
            <form className="nick-screen-form" onSubmit={onSubmit}>
              {passwordInput('Senha', 'current-password')}
              <button className="btn btn-primary" disabled={busy || !password}>
                {busy ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          </>
        ) : (
          <p className="nick-screen-text">
            <strong>{step.name}</strong> está sendo usado como convidado em outro dispositivo. Se é seu, abra o jogo
            lá, toque no seu nick, escolha <strong>Sincronizar dispositivo</strong> e crie uma senha.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="link-button" onClick={back}>
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
      <form className="nick-screen-form" onSubmit={onSubmit}>
        <label className="nick-label" htmlFor="nick">
          Escolha seu nick
        </label>
        <input
          id="nick"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={NICK_MAX_LENGTH}
          autoComplete="username"
          spellCheck={false}
          autoFocus
          disabled={busy}
        />
        {passwordInput('Senha (opcional)', 'current-password')}
        <button className="btn btn-primary btn-lg" disabled={busy || !nick.trim() || !password}>
          {busy && password ? 'Verificando...' : inviteCode ? 'Entrar na sala' : 'Entrar'}
        </button>
      </form>
      <button className="btn btn-secondary nick-guest" onClick={onGuest} disabled={busy || !nick.trim()}>
        Continuar como convidado
      </button>
      {error && <p className="error">{error}</p>}
      <p className="nick-screen-hint">
        Com senha, você entra com esse nick em qualquer dispositivo. Como convidado, ele fica só neste navegador.
      </p>
    </section>
  );
}
