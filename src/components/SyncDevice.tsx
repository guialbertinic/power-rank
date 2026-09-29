import { useState } from 'react';
import { createSyncCode } from '../api';
import type { Identity } from '../nick';

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; code: string } | { kind: 'error' };

/**
 * "Sincronizar dispositivo": gera um código para usar o mesmo nick em outro aparelho.
 * Cada código novo invalida o anterior (o servidor só guarda o hash do último).
 */
export default function SyncDevice({ identity }: { identity: Identity }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  if (!identity.token) return null;
  const token = identity.token;

  const generate = async () => {
    setStatus({ kind: 'loading' });
    setCopied(false);
    try {
      setStatus({ kind: 'ready', code: await createSyncCode(identity.name, token) });
    } catch {
      setStatus({ kind: 'error' });
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Sem permissão de clipboard: o código continua visível para copiar à mão.
    }
  };

  if (status.kind === 'idle' || status.kind === 'loading') {
    return (
      <button className="link-button" onClick={generate} disabled={status.kind === 'loading'}>
        {status.kind === 'loading' ? 'Gerando código...' : 'Sincronizar dispositivo'}
      </button>
    );
  }

  return (
    <div className="panel sync-panel">
      {status.kind === 'error' ? (
        <p className="error">Não foi possível gerar o código. Tente de novo.</p>
      ) : (
        <>
          <p className="score-label">Código de sincronização</p>
          <p className="recovery-code">{status.code}</p>
          <p className="nick-screen-text">
            No outro dispositivo, abra o jogo, digite o nick <strong>{identity.name}</strong> e depois este código.
            Gerar um novo código invalida este.
          </p>
          <button className="link-button" onClick={() => copy(status.code)}>
            {copied ? 'Copiado!' : 'Copiar código'}
          </button>
        </>
      )}
      <button className="link-button" onClick={() => setStatus({ kind: 'idle' })}>
        Fechar
      </button>
    </div>
  );
}
