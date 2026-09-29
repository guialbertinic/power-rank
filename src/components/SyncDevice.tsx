import { useState, type FormEvent } from 'react';
import { setPassword } from '../api';
import { passwordProblem, PASSWORD_MAX_LENGTH } from '../game/account';
import type { Profile } from '../game/cosmetics';
import type { Identity } from '../nick';

interface Props {
  identity: Identity;
  profile: Profile | null;
  /** Busca de novo saldo, itens e visual no servidor. Rejeita se falhar. */
  onRefresh: () => Promise<void>;
}

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

/**
 * "Sincronizar dispositivo": criar a senha do nick (para entrar com ele em outro dispositivo) e forçar a
 * sincronização, que recarrega do servidor o que mudou em outro aparelho.
 */
export default function SyncDevice({ identity, profile, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [sync, setSync] = useState<SyncStatus>('idle');

  if (!identity.token) return null;
  const token = identity.token;

  if (!open) {
    return (
      <button className="link-button" onClick={() => setOpen(true)}>
        Sincronizar dispositivo
      </button>
    );
  }

  const createPassword = (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password) ?? (password !== confirm ? 'As senhas não são iguais' : null);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    setPassword(identity.name, token, password)
      .then(() => {
        setCreated(true);
        setPasswordValue('');
        setConfirm('');
        return onRefresh();
      })
      .catch((err) => setError(err instanceof TypeError ? 'Sem conexão com o servidor.' : err.message))
      .finally(() => setSaving(false));
  };

  const forceSync = () => {
    setSync('syncing');
    onRefresh().then(
      () => setSync('done'),
      () => setSync('error'),
    );
  };

  return (
    <div className="panel sync-panel">
      <p className="score-label">Sincronizar dispositivo</p>

      {profile?.hasPassword ? (
        <p className="nick-screen-text">
          {created && 'Senha criada! '}Em outro dispositivo, entre com o nick <strong>{identity.name}</strong> e a sua
          senha.
        </p>
      ) : profile ? (
        <form className="sync-password-form" onSubmit={createPassword}>
          <p className="nick-screen-text">
            Crie uma senha para entrar como <strong>{identity.name}</strong> em outro dispositivo.
          </p>
          {/* Campo de usuário escondido: ajuda o gerenciador de senhas a salvar o par nick + senha. */}
          <input type="text" value={identity.name} autoComplete="username" readOnly hidden />
          <input
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="Nova senha"
            aria-label="Nova senha"
            autoComplete="new-password"
            disabled={saving}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="Repita a senha"
            aria-label="Repita a senha"
            autoComplete="new-password"
            disabled={saving}
          />
          <button className="btn btn-primary btn-sm" disabled={saving || !password || !confirm}>
            {saving ? 'Salvando...' : 'Criar senha'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      ) : null}

      <div className="sync-force">
        <button className="btn btn-secondary btn-sm" onClick={forceSync} disabled={sync === 'syncing'}>
          {sync === 'syncing' ? 'Sincronizando...' : 'Forçar sincronização'}
        </button>
        <p className="muted sync-note">
          {sync === 'done'
            ? 'Pronto: saldo, itens e visual atualizados.'
            : sync === 'error'
              ? 'Não foi possível sincronizar. Tente de novo.'
              : 'Jogou em outro dispositivo? Traz o saldo, os itens e o visual salvos no servidor.'}
        </p>
      </div>

      <button className="link-button" onClick={() => setOpen(false)}>
        Fechar
      </button>
    </div>
  );
}
