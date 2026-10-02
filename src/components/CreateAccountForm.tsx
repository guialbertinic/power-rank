import { useState, type FormEvent } from 'react';
import { claimNick, setPassword } from '../api';
import { passwordProblem, PASSWORD_MAX_LENGTH } from '../game/account';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import Turnstile from './Turnstile';

interface Props {
  identity: Identity;
  /** Conta antiga sem senha: depois de criar, recarrega o perfil (hasPassword). */
  onRefresh: () => Promise<void>;
  /** Convidado criou a conta: passa a jogar com o token dela. */
  onAccountCreated: (identity: Identity) => void;
}

/**
 * Tela "Minha conta":
 * - convidado: cria a conta com o nick atual (reserva o nick) e uma senha;
 * - conta antiga sem senha (criada antes da 0006): cria a senha.
 * Com senha, o jogador entra com nick + senha em qualquer aparelho.
 */
export default function CreateAccountForm({ identity, onRefresh, onAccountCreated }: Props) {
  const { t, lang } = useI18n();
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Anti-bot ao criar conta (convidado): token do widget, se é exigido e chave para gerar outro. */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean | null>(null); // null = ainda não sabe
  const [turnstileKey, setTurnstileKey] = useState(0);
  const isGuest = !identity.token;

  const save = async () => {
    if (identity.token) {
      await setPassword(identity.name, identity.token, password);
      await onRefresh();
      return;
    }
    const result = await claimNick(identity.name, null, password, turnstileToken);
    if (!result.ok) {
      throw new Error(result.taken ? t('sync.nickTaken') : result.error);
    }
    onAccountCreated({ name: result.name, token: result.token });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password) ?? (password !== confirm ? t('password.mismatch') : null);
    if (problem) return setError(serverText(problem, lang));
    setSaving(true);
    setError(null);
    save()
      .then(() => {
        setPasswordValue('');
        setConfirm('');
      })
      .catch((err) => {
        setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang));
        // O token do anti-bot vale uma vez só: gera outro para a próxima tentativa.
        setTurnstileToken(null);
        setTurnstileKey((k) => k + 1);
      })
      .finally(() => setSaving(false));
  };

  return (
    <form className="sync-password-form" onSubmit={onSubmit}>
      <p className="nick-screen-text">
        {isGuest ? (
          <>
            {t('sync.guestBefore')}
            <strong>{identity.name}</strong>
            {t('sync.guestAfter')}
          </>
        ) : (
          <>
            {t('sync.passwordBefore')}
            <strong>{identity.name}</strong>
            {t('sync.passwordAfter')}
          </>
        )}
      </p>
      {/* Campo de usuário escondido: ajuda o gerenciador de senhas a salvar o par nick + senha. */}
      <input type="text" value={identity.name} autoComplete="username" readOnly hidden />
      <input
        type="password"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        maxLength={PASSWORD_MAX_LENGTH}
        placeholder={t('password.placeholder')}
        aria-label={t('password.new')}
        autoComplete="new-password"
        disabled={saving}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        maxLength={PASSWORD_MAX_LENGTH}
        placeholder={t('password.confirm')}
        aria-label={t('password.repeat')}
        autoComplete="new-password"
        disabled={saving}
      />
      {isGuest && <Turnstile key={turnstileKey} onToken={setTurnstileToken} onReady={setTurnstileRequired} />}
      <button
        className="btn btn-primary btn-sm"
        disabled={saving || !password || !confirm || (isGuest && turnstileRequired !== false && !turnstileToken)}
        aria-busy={saving}
      >
        {isGuest ? t('sync.createAccount') : t('sync.createPassword')}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
