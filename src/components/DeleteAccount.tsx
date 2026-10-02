import { useState, type FormEvent } from 'react';
import { deleteAccount } from '../api';
import { serverText, useI18n } from '../i18n';

interface Props {
  token: string;
  /** A conta tem senha: pede para confirmar. */
  hasPassword: boolean;
  onDeleted: () => void;
}

/**
 * "Excluir minha conta" (menu do perfil, só contas): avisa o que se perde e pede a senha. Excluída a conta, o
 * nick fica livre e o jogo volta para a tela do nick.
 */
export default function DeleteAccount({ token, hasPassword, onDeleted }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        className="link-button delete-account-toggle"
        onClick={() => {
          setPassword('');
          setError(null);
          setOpen(true);
        }}
      >
        {t('deleteAccount.title')}
      </button>
    );
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    deleteAccount(token, password)
      .then(onDeleted)
      .catch((err) => setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang)))
      .finally(() => setBusy(false));
  };

  return (
    <form className="change-nick delete-account" onSubmit={onSubmit}>
      <p className="score-label">{t('deleteAccount.title')}</p>
      <p className="delete-account-warning">{t('deleteAccount.warning')}</p>
      {hasPassword && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label={t('deleteAccount.password')}
          placeholder={t('deleteAccount.password')}
          autoComplete="current-password"
          autoFocus
          disabled={busy}
        />
      )}
      <div className="change-nick-actions">
        <button className="btn btn-danger btn-sm" disabled={busy || (hasPassword && !password)} aria-busy={busy}>
          {t('deleteAccount.confirm')}
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
