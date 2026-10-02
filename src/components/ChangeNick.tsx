import { useState, type FormEvent } from 'react';
import { nickStatus, renameNick } from '../api';
import { serverText, useI18n } from '../i18n';
import { NICK_MAX_LENGTH, sameNick, type Identity } from '../nick';

interface Props {
  identity: Identity;
  onChanged: (identity: Identity) => void;
}

/**
 * "Trocar nick" (tela Minha conta). Não troca de conta:
 * - conta: renomeia a própria conta, se o novo nick não for de outra conta (partidas, moedas e itens continuam);
 * - convidado: só passa a usar outro nick, desde que não seja de uma conta.
 */
export default function ChangeNick({ identity, onChanged }: Props) {
  const { t, lang } = useI18n();
  const [nick, setNick] = useState(identity.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const change = async (name: string) => {
    if (identity.token) return onChanged({ name: await renameNick(identity.token, name), token: identity.token });
    // Convidado: o mesmo nick com outras maiúsculas é sempre dele; outro nick precisa estar livre de contas.
    if (!sameNick(name, identity.name) && (await nickStatus(name)).exists) {
      throw new Error(t('changeNick.taken'));
    }
    onChanged({ name, token: null });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = nick.trim();
    if (!name || name === identity.name) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    change(name)
      .then(() => setSaved(true))
      .catch((err) => setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang)))
      .finally(() => setBusy(false));
  };

  return (
    <form className="change-nick" onSubmit={onSubmit}>
      <input
        value={nick}
        onChange={(e) => {
          setNick(e.target.value);
          setSaved(false);
        }}
        maxLength={NICK_MAX_LENGTH}
        aria-label={t('changeNick.newNick')}
        autoComplete="off"
        spellCheck={false}
        disabled={busy}
      />
      <button className="btn btn-primary btn-sm" disabled={busy || !nick.trim() || nick.trim() === identity.name} aria-busy={busy}>
        {t('common.save')}
      </button>
      {saved && <p className="muted account-note">{t('account.saved')}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
