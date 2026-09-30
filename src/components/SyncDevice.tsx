import { useState, type FormEvent } from 'react';
import { claimNick, setPassword } from '../api';
import { passwordProblem, PASSWORD_MAX_LENGTH } from '../game/account';
import type { Profile } from '../game/cosmetics';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import Turnstile from './Turnstile';

interface Props {
  identity: Identity;
  profile: Profile | null;
  /** Busca de novo saldo, itens e visual no servidor. Rejeita se falhar. */
  onRefresh: () => Promise<void>;
  /** Convidado criou a conta: passa a jogar com o token dela. */
  onAccountCreated: (identity: Identity) => void;
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

/**
 * "Sincronizar dispositivo":
 * - convidado: cria a conta com o nick atual (reserva o nick) e uma senha;
 * - conta antiga sem senha: cria a senha;
 * - conta com senha: lembra de entrar com nick + senha no outro dispositivo.
 * Para contas, "Forçar sincronização" recarrega do servidor o que mudou em outro aparelho.
 */
export default function SyncDevice({ identity, profile, onRefresh, onAccountCreated }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [sync, setSync] = useState<SyncStatus>('idle');
  /** Anti-bot ao criar conta (convidado): token do widget, se é exigido e chave para gerar outro. */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean | null>(null); // null = ainda não sabe
  const [turnstileKey, setTurnstileKey] = useState(0);

  if (!open) {
    return (
      <button className="link-button" onClick={() => setOpen(true)}>
        {t('sync.title')}
      </button>
    );
  }

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
        setCreated(true);
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

  const forceSync = () => {
    setSync('syncing');
    onRefresh().then(
      () => setSync('done'),
      () => setSync('error'),
    );
  };

  const needsPassword = isGuest || (profile !== null && !profile.hasPassword);

  return (
    <div className="panel sync-panel">
      <p className="score-label">{t('sync.title')}</p>

      {needsPassword ? (
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
      ) : profile ? (
        <p className="nick-screen-text">
          {created && t('sync.ready')}
          {t('sync.otherDeviceBefore')}
          <strong>{identity.name}</strong>
          {t('sync.otherDeviceAfter')}
        </p>
      ) : null}

      {!isGuest && (
        <div className="sync-force">
          <button
            className="btn btn-secondary btn-sm"
            onClick={forceSync}
            disabled={sync === 'syncing'}
            aria-busy={sync === 'syncing'}
          >
            {t('sync.force')}
          </button>
          {(sync === 'done' || sync === 'error') && (
            <p className="muted sync-note">{sync === 'done' ? t('sync.done') : t('sync.error')}</p>
          )}
        </div>
      )}

      <button className="link-button" onClick={() => setOpen(false)}>
        {t('common.close')}
      </button>
    </div>
  );
}
