import { useEffect, useRef, useState } from 'react';
import { useI18n, type Lang } from '../i18n';
import { LegalLink } from './Legal';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
];

interface Props {
  /** Modo gravação: esconde a barra de perfil, o Arcade e o rodapé, para gravar a tela. */
  recording: boolean;
  onRecordingChange: (on: boolean) => void;
}

/**
 * Configurações (engrenagem no canto superior esquerdo, em todas as telas): idioma, modo gravação e links de
 * termos/privacidade. As escolhas ficam salvas neste navegador.
 */
export default function SettingsMenu({ recording, onRecordingChange }: Props) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        className="settings-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('settings.title')}
        title={t('settings.title')}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.9a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
      </button>
      {open && (
        <div className="panel settings-panel" role="dialog" aria-label={t('settings.title')}>
          <p className="score-label">{t('settings.title')}</p>
          <p className="settings-label">{t('settings.language')}</p>
          <div className="settings-langs" role="radiogroup" aria-label={t('settings.language')}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={lang === l.id}
                className={`shop-filter-option${lang === l.id ? ' selected' : ''}`}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <label className="settings-check">
            <input type="checkbox" checked={recording} onChange={(e) => onRecordingChange(e.target.checked)} />
            <span>
              {t('settings.recording')}
              <small>{t('settings.recordingHint')}</small>
            </span>
          </label>
          <p className="settings-label">{t('settings.legal')}</p>
          <div className="settings-legal">
            <LegalLink doc="terms">{t('legal.terms')}</LegalLink>
            <LegalLink doc="privacy">{t('legal.privacy')}</LegalLink>
          </div>
        </div>
      )}
    </div>
  );
}
