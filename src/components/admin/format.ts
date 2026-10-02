import type { AdminAction } from '../../game/admin';
import type { FeatureId } from '../../game/features';
import { serverText, type I18n, type Key, type Lang } from '../../i18n';

/** Formatação comum das telas de admin. */

const locale = (lang: Lang) => (lang === 'pt' ? 'pt-BR' : 'en-US');

export const numberText = (n: number, lang: Lang) => n.toLocaleString(locale(lang));

export const dateTimeText = (ms: number, lang: Lang) =>
  new Date(ms).toLocaleString(locale(lang), { dateStyle: 'short', timeStyle: 'short' });

export const percentText = (ratio: number, lang: Lang) =>
  ratio.toLocaleString(locale(lang), { style: 'percent', maximumFractionDigits: 1 });

/** Mensagem de erro de uma chamada, já traduzida (sem resposta = provavelmente o login do Access expirou). */
export const errorText = (err: unknown, lang: Lang) => serverText(err instanceof Error ? err.message : 'Erro interno', lang);

export const FEATURE_LABEL: Record<FeatureId, Key> = {
  slots: 'admin.feature.slots',
  plinko: 'admin.feature.plinko',
  scratch: 'admin.feature.scratch',
  mystery_box: 'admin.feature.mystery_box',
};

/** Uma linha do registro de ações, em texto. */
export function actionText(action: AdminAction, t: I18n['t'], lang: Lang): string {
  const d = action.details;
  switch (action.action) {
    case 'feature':
      return t(d.enabled ? 'admin.log.featureOn' : 'admin.log.featureOff', {
        feature: FEATURE_LABEL[d.id as FeatureId] ? t(FEATURE_LABEL[d.id as FeatureId]) : String(d.id),
      });
    case 'coins': {
      const delta = Number(d.delta);
      return t('admin.log.coins', {
        delta: `${delta > 0 ? '+' : ''}${numberText(delta, lang)}`,
        coins: numberText(Number(d.coins), lang),
        reason: String(d.reason ?? ''),
      });
    }
    case 'rename':
      return t('admin.log.rename', { from: String(d.from), to: String(d.to) });
    case 'password':
      return t('admin.log.password');
  }
}
