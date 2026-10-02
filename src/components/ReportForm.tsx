import { useState, type FormEvent } from 'react';
import { sendReport } from '../api';
import { REPORT_REASONS, type ReportKind, type ReportReason } from '../game/reports';
import { serverText, useI18n } from '../i18n';
import { loadIdentity } from '../nick';

export interface ReportTarget {
  /** Nick (denúncia de nick) ou id do personagem (imagem). */
  id: string;
  label: string;
}

interface Props {
  kind: ReportKind;
  /** Quem pode ser denunciado (com mais de um, aparece a escolha). */
  targets: ReportTarget[];
  onClose: () => void;
}

/**
 * Denúncia de nick ou pedido de remoção de imagem: escolhe o alvo (se houver mais de um) e o motivo, e manda para
 * a fila de moderação. Quem denuncia vem do navegador (conta, se tiver; senão o servidor usa o IP).
 */
export function ReportForm({ kind, targets, onClose }: Props) {
  const { t, lang } = useI18n();
  const [target, setTarget] = useState(targets.length === 1 ? targets[0].id : '');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!target || !reason) return;
    setStatus('sending');
    setError(null);
    sendReport(loadIdentity()?.token ?? null, kind, target, reason)
      .then(() => setStatus('sent'))
      .catch((err) => {
        setStatus('idle');
        setError(err instanceof TypeError ? t('common.offline') : serverText(err.message, lang));
      });
  };

  if (status === 'sent') {
    return (
      <div className="panel report-form" role="status">
        <p>{t('report.sent')}</p>
        <button className="link-button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    );
  }

  return (
    <form className="panel report-form" onSubmit={onSubmit}>
      <p className="score-label">{t(kind === 'nick' ? 'report.nick' : 'report.image')}</p>
      {targets.length > 1 ? (
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t(kind === 'nick' ? 'report.who' : 'report.which')}>
          <option value="" disabled>
            {t(kind === 'nick' ? 'report.who' : 'report.which')}
          </option>
          {targets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <strong className="report-target">{targets[0]?.label}</strong>
      )}
      <div className="report-reasons" role="radiogroup" aria-label={t('report.reason')}>
        {REPORT_REASONS[kind].map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            className={`shop-filter-option${reason === r ? ' selected' : ''}`}
            onClick={() => setReason(r)}
          >
            {t(`report.reason.${r}`)}
          </button>
        ))}
      </div>
      <div className="change-nick-actions">
        <button className="btn btn-primary btn-sm" disabled={!target || !reason || status === 'sending'} aria-busy={status === 'sending'}>
          {t('report.send')}
        </button>
        <button type="button" className="link-button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

/** Link discreto ("Denunciar nick", "Reportar imagem") que abre o formulário logo abaixo. */
export default function ReportLink({ kind, targets }: Omit<Props, 'onClose'>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!targets.length) return null;
  return (
    <div className="report-link">
      {open ? (
        <ReportForm kind={kind} targets={targets} onClose={() => setOpen(false)} />
      ) : (
        <button className="link-button" onClick={() => setOpen(true)}>
          {t(kind === 'nick' ? 'report.nick' : 'report.image')}
        </button>
      )}
    </div>
  );
}
