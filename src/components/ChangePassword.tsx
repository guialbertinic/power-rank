import { useState, type FormEvent } from 'react';
import { changePassword } from '../api';
import { passwordProblem, PASSWORD_MAX_LENGTH } from '../game/account';
import { serverText, useI18n } from '../i18n';

interface Props {
  name: string;
  token: string;
  /** Senha trocada: os outros aparelhos saíram (recarrega a contagem). */
  onChanged: () => void;
}

/** "Trocar senha" (tela Minha conta): pede a atual; os outros aparelhos da conta são desconectados. */
export default function ChangePassword({ name, token, onChanged }: Props) {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password) ?? (password !== confirm ? t('password.mismatch') : null);
    if (problem) return setError(serverText(problem, lang));
    setBusy(true);
    setError(null);
    setDone(false);
    changePassword(token, current, password)
      .then(() => {
        setCurrent('');
        setPassword('');
        setConfirm('');
        setDone(true);
        onChanged();
      })
      .catch((err) => setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang)))
      .finally(() => setBusy(false));
  };

  return (
    <form className="sync-password-form" onSubmit={onSubmit}>
      <input type="text" value={name} autoComplete="username" readOnly hidden />
      <input
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder={t('changePassword.current')}
        aria-label={t('changePassword.current')}
        autoComplete="current-password"
        disabled={busy}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={PASSWORD_MAX_LENGTH}
        placeholder={t('password.new')}
        aria-label={t('password.new')}
        autoComplete="new-password"
        disabled={busy}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        maxLength={PASSWORD_MAX_LENGTH}
        placeholder={t('password.repeat')}
        aria-label={t('password.repeat')}
        autoComplete="new-password"
        disabled={busy}
      />
      <button className="btn btn-primary btn-sm" disabled={busy || !current || !password || !confirm} aria-busy={busy}>
        {t('changePassword.submit')}
      </button>
      {done && <p className="muted account-note">{t('changePassword.done')}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
