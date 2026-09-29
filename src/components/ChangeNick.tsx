import { useState, type FormEvent } from 'react';
import { nickStatus, renameNick } from '../api';
import { NICK_MAX_LENGTH, sameNick, type Identity } from '../nick';

interface Props {
  identity: Identity;
  onChanged: (identity: Identity) => void;
}

/**
 * "Trocar nick" (menu do perfil). Não troca de conta:
 * - conta: renomeia a própria conta, se o novo nick não for de outra conta (partidas, moedas e itens continuam);
 * - convidado: só passa a usar outro nick, desde que não seja de uma conta.
 */
export default function ChangeNick({ identity, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(identity.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        className="link-button"
        onClick={() => {
          setNick(identity.name);
          setError(null);
          setOpen(true);
        }}
      >
        Trocar nick
      </button>
    );
  }

  const change = async (name: string) => {
    if (identity.token) return onChanged({ name: await renameNick(identity.token, name), token: identity.token });
    // Convidado: o mesmo nick com outras maiúsculas é sempre dele; outro nick precisa estar livre de contas.
    if (!sameNick(name, identity.name) && (await nickStatus(name)).exists) {
      throw new Error('Esse nick é de uma conta. Escolha outro.');
    }
    onChanged({ name, token: null });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name || name === identity.name) return setOpen(false);
    setBusy(true);
    setError(null);
    change(name)
      .then(() => setOpen(false))
      .catch((err) => setError(err instanceof TypeError ? 'Sem conexão com o servidor.' : err.message))
      .finally(() => setBusy(false));
  };

  return (
    <form className="change-nick" onSubmit={onSubmit}>
      <p className="score-label">Trocar nick</p>
      <input
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        maxLength={NICK_MAX_LENGTH}
        aria-label="Novo nick"
        autoComplete="off"
        spellCheck={false}
        autoFocus
        disabled={busy}
      />
      <div className="change-nick-actions">
        <button className="btn btn-primary btn-sm" disabled={busy || !nick.trim()}>
          {busy ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)} disabled={busy}>
          Cancelar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
