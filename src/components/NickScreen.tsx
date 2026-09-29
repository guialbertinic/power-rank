import { useState, type FormEvent } from 'react';
import { claimNick, nickStatus } from '../api';
import { passwordProblem, PASSWORD_MAX_LENGTH } from '../game/account';
import { NICK_MAX_LENGTH, suggestedNick, tokenFor, type Identity } from '../nick';
import Turnstile from './Turnstile';

interface Props {
  /** Convite pendente: depois de escolher o nick, o jogador entra direto nessa sala. */
  inviteCode: string;
  /** Motivo de ter voltado para cá (ex: o nick deixou de ser deste navegador). */
  reason: string | null;
  onDone: (identity: Identity) => void;
}

type Step =
  | { kind: 'nick' }
  /** Nick com conta: pede a senha. */
  | { kind: 'login'; name: string }
  /** Nick livre: cria a conta (senha + confirmação). */
  | { kind: 'create'; name: string }
  /** Conta antiga, criada antes da senha: só entra no aparelho onde já era usada. */
  | { kind: 'no-password'; name: string };

/**
 * Primeira tela do jogo. Só a conta (nick + senha) reserva o nick; o convidado joga com qualquer nick que não
 * seja de uma conta, sem reservar nada e sem ganhar moedas. Dá para criar a conta depois, em
 * "Sincronizar dispositivo", na home.
 */
export default function NickScreen({ inviteCode, reason, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'nick' });
  const [nick, setNick] = useState(suggestedNick);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(reason);
  /** Botão que está esperando o servidor (mostra o loading nele). */
  const [pending, setPending] = useState<'login' | 'guest' | 'password' | null>(null);
  /** Anti-bot na criação de conta: token do widget e se ele é exigido (desligado = não precisa). */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean | null>(null); // null = ainda não sabe
  const [turnstileKey, setTurnstileKey] = useState(0);
  const resetTurnstile = () => {
    setTurnstileToken(null);
    setTurnstileKey((k) => k + 1);
  };
  const busy = pending !== null;

  const run = (button: 'login' | 'guest' | 'password', action: () => Promise<void>) => {
    setPending(button);
    setError(null);
    action()
      .catch(() => setError('Sem conexão com o servidor. Tente de novo.'))
      .finally(() => setPending(null));
  };

  const goTo = (next: Step) => {
    setStep(next);
    setPassword('');
    setConfirm('');
    setError(null);
  };

  /** Nick com conta cujo token está neste navegador: entra direto, sem senha. */
  const tryStoredToken = async (name: string) => {
    const token = tokenFor(name);
    if (!token) return false;
    const result = await claimNick(name, token);
    if (result.ok) onDone({ name: result.name, token: result.token });
    return result.ok;
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name) return;
    run('login', async () => {
      const status = await nickStatus(name);
      if (!status.exists) return status.problem ? setError(status.problem) : goTo({ kind: 'create', name });
      if (await tryStoredToken(name)) return;
      goTo(status.hasPassword ? { kind: 'login', name } : { kind: 'no-password', name });
    });
  };

  const onGuest = () => {
    const name = nick.trim();
    if (!name) return;
    run('guest', async () => {
      const status = await nickStatus(name);
      if (!status.exists) return status.problem ? setError(status.problem) : onDone({ name, token: null });
      if (await tryStoredToken(name)) return;
      setError('Esse nick já está em uso.');
    });
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'login' && step.kind !== 'create') return;
    if (step.kind === 'create') {
      const problem = passwordProblem(password) ?? (password !== confirm ? 'As senhas não são iguais' : null);
      if (problem) return setError(problem);
    }
    const { name } = step;
    run('password', async () => {
      const result = await claimNick(name, null, password, turnstileToken);
      if (result.ok) return onDone({ name: result.name, token: result.token });
      setError(result.taken ? 'Esse nick acabou de virar conta de outra pessoa. Escolha outro.' : result.error);
      // O token do anti-bot vale uma vez só: gera outro para a próxima tentativa.
      if (step.kind === 'create') resetTurnstile();
    });
  };

  const back = (
    <button className="link-button" onClick={() => goTo({ kind: 'nick' })} disabled={busy}>
      Voltar
    </button>
  );

  const passwordInput = (value: string, onChange: (v: string) => void, label: string, autoComplete: string) => (
    <input
      type="password"
      className="nick-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={PASSWORD_MAX_LENGTH}
      placeholder={label}
      aria-label={label}
      autoComplete={autoComplete}
      autoFocus={label === 'Senha'}
      disabled={busy}
    />
  );

  const invite = inviteCode && (
    <p className="nick-screen-invite">
      Você foi convidado para a sala <strong>{inviteCode}</strong>
    </p>
  );

  if (step.kind === 'login' || step.kind === 'create') {
    const creating = step.kind === 'create';
    return (
      <section className="panel nick-screen">
        {invite}
        <p className="score-label">{creating ? 'Criar conta' : 'Entrar'}</p>
        <p className="nick-screen-text">
          {creating ? (
            <>
              <strong>{step.name}</strong> está livre. Crie uma senha para logar em outros dispositivos.
            </>
          ) : (
            <>
              Digite a senha de <strong>{step.name}</strong>.
            </>
          )}
        </p>
        <form className="nick-screen-form" onSubmit={onPassword}>
          {/* Campo de usuário escondido: ajuda o gerenciador de senhas a salvar o par nick + senha. */}
          <input type="text" value={step.name} autoComplete="username" readOnly hidden />
          {passwordInput(password, setPassword, 'Senha', creating ? 'new-password' : 'current-password')}
          {creating && passwordInput(confirm, setConfirm, 'Confirmar senha', 'new-password')}
          {creating && <Turnstile key={turnstileKey} onToken={setTurnstileToken} onReady={setTurnstileRequired} />}
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || !password || (creating && (!confirm || (turnstileRequired !== false && !turnstileToken)))}
            aria-busy={pending === 'password'}
          >
            {creating ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        {back}
      </section>
    );
  }

  if (step.kind === 'no-password') {
    return (
      <section className="panel nick-screen">
        <p className="score-label">Conta sem senha</p>
        <p className="nick-screen-text">
          <strong>{step.name}</strong> é uma conta sem senha. Se é sua, abra o jogo no dispositivo onde você usa esse
          nick, toque nele, escolha <strong>Sincronizar dispositivo</strong> e crie uma senha.
        </p>
        {back}
      </section>
    );
  }

  return (
    <section className="panel nick-screen">
      {invite}
      <form className="nick-screen-form" onSubmit={onLogin}>
        <label className="nick-label" htmlFor="nick">
          Username
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
        <div className="nick-actions">
          <button
            className="btn btn-primary nick-login"
            disabled={busy || !nick.trim()}
            aria-busy={pending === 'login'}
          >
            Login
            <small>(criar conta)</small>
          </button>
          <button
            type="button"
            className="btn btn-secondary nick-guest"
            onClick={onGuest}
            disabled={busy || !nick.trim()}
            aria-busy={pending === 'guest'}
          >
            Convidado
          </button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
