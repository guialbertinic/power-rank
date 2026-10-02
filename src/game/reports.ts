/** Denúncias dos jogadores (fila de moderação do admin). Compartilhado entre o Worker e o site. */

export type ReportKind = 'nick' | 'image';

/** Motivos que cada tipo de denúncia aceita. */
export const REPORT_REASONS = {
  nick: ['offensive', 'impersonation', 'other'],
  image: ['wrong', 'offensive', 'rights', 'other'],
} as const satisfies Record<ReportKind, readonly string[]>;

export type ReportReason = (typeof REPORT_REASONS)[ReportKind][number];

export const isReportKind = (value: unknown): value is ReportKind => value === 'nick' || value === 'image';

export const isReportReason = (kind: ReportKind, value: unknown): value is ReportReason =>
  (REPORT_REASONS[kind] as readonly unknown[]).includes(value);
