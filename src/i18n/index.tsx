import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { pt, type Key } from './pt';
import { MODES, type Mode } from '../game/modes';

/**
 * Tradução da interface (português e inglês). O português (`pt.ts`) é a base; `en.ts` precisa ter todas as
 * chaves (o TypeScript reclama se faltar). Textos com variáveis usam `{nome}`: t('x', { nome: 'Ana' }).
 * O servidor responde em português; `serverText` traduz as mensagens dele (tabela em `server.ts`).
 */
export type Lang = 'pt' | 'en';
export type { Key };
export { cosmeticLabel, symbolLabel } from './catalog';
export { serverText } from './server';

const DICTS: Record<Lang, Record<Key, string>> = { pt, en };
const LANG_KEY = 'power-rank:lang';

/** Idioma salvo neste navegador ou, na primeira visita, o do navegador (pt* → português, o resto → inglês). */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    // Storage indisponível: usa o idioma do navegador.
  }
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

type Params = Record<string, string | number>;

export function translate(lang: Lang, key: Key, params?: Params): string {
  const text = DICTS[lang][key] ?? pt[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : text;
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key, params?: Params) => string;
}

/** Nome da categoria; no Desafio Diário, "Desafio diário · <categoria>". */
export function dailyLabel(t: I18n['t'], mode: Mode, daily: boolean): string {
  const label = MODES.find((m) => m.id === mode)?.label ?? '';
  return daily ? `${t('daily.label')} · ${label}` : label;
}

const I18nContext = createContext<I18n>({
  lang: 'pt',
  setLang: () => {},
  t: (key, params) => translate('pt', key, params),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          localStorage.setItem(LANG_KEY, next);
        } catch {
          // Storage indisponível: só não lembra entre visitas.
        }
      },
      t: (key, params) => translate(lang, key, params),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
