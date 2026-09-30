import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { CONTACT_EMAIL, legalText, UPDATED, type LegalDoc } from '../i18n/legal';

/** Link direto para as páginas (ex: para colocar na bio ou exigido por rede de anúncios): /?termos, /?privacidade. */
const URL_PARAMS: Record<string, LegalDoc> = { termos: 'terms', terms: 'terms', privacidade: 'privacy', privacy: 'privacy' };

function docFromUrl(): LegalDoc | null {
  const params = new URLSearchParams(window.location.search);
  for (const [param, doc] of Object.entries(URL_PARAMS)) if (params.has(param)) return doc;
  return null;
}

function clearDocFromUrl() {
  const url = new URL(window.location.href);
  for (const param of Object.keys(URL_PARAMS)) url.searchParams.delete(param);
  window.history.replaceState(null, '', url);
}

const LegalContext = createContext<(doc: LegalDoc) => void>(() => {});

/**
 * Termos e privacidade abrem por cima de qualquer tela (sem desmontar nada: uma partida ou sala da party
 * continuam por baixo). `LegalLink` abre de qualquer componente.
 */
export function LegalProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<LegalDoc | null>(docFromUrl);
  const close = () => {
    setDoc(null);
    clearDocFromUrl();
  };
  return (
    <LegalContext.Provider value={setDoc}>
      {children}
      {doc && <LegalOverlay doc={doc} onClose={close} onSwitch={setDoc} />}
    </LegalContext.Provider>
  );
}

export function LegalLink({ doc, children }: { doc: LegalDoc; children: ReactNode }) {
  const open = useContext(LegalContext);
  return (
    <button type="button" className="legal-link" onClick={() => open(doc)}>
      {children}
    </button>
  );
}

/** Troca `{email}` pelo link do contato. */
function withEmail(text: string): ReactNode {
  const parts = text.split('{email}');
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>,
          part,
        ],
  );
}

function LegalOverlay({ doc, onClose, onSwitch }: { doc: LegalDoc; onClose: () => void; onSwitch: (doc: LegalDoc) => void }) {
  const { t, lang } = useI18n();
  const text = legalText(doc, lang);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const updated = new Date(`${UPDATED}T12:00:00`).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Foco no fechar, Esc fecha e a página de trás não rola junto.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Trocou de documento (link "Privacidade" dentro dos termos): volta ao topo.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [doc]);

  return (
    <div className="legal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-title" ref={scrollRef}>
      <article className="panel legal">
        <header className="legal-header">
          <div>
            <h2 id="legal-title">{text.title}</h2>
            <p className="muted">{t('legal.updated', { date: updated })}</p>
          </div>
          <button ref={closeRef} className="btn btn-sm btn-ghost legal-close" onClick={onClose}>
            {t('legal.close')}
          </button>
        </header>
        <nav className="legal-tabs" aria-label={t('legal.nav')}>
          {(['terms', 'privacy'] as const).map((d) => (
            <button
              key={d}
              className={`shop-filter-option${d === doc ? ' selected' : ''}`}
              aria-current={d === doc ? 'page' : undefined}
              onClick={() => onSwitch(d)}
            >
              {t(d === 'terms' ? 'legal.terms' : 'legal.privacy')}
            </button>
          ))}
        </nav>
        <p>{text.intro}</p>
        {text.sections.map((section) => (
          <section key={section.title}>
            <h3 className="section-title">{section.title}</h3>
            {section.body.map((block, i) =>
              typeof block === 'string' ? (
                <p key={i}>{withEmail(block)}</p>
              ) : (
                <ul key={i}>
                  {block.map((item) => (
                    <li key={item}>{withEmail(item)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
