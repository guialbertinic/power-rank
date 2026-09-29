import { useEffect, useRef, useState } from 'react';
import { fetchConfig } from '../api';
import { useI18n } from '../i18n';

/** API global do script do Turnstile (https://challenges.cloudflare.com/turnstile/v0/api.js). */
interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Turnstile indisponível'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

interface Props {
  /** Chamado com o token quando o desafio passa (e com null quando expira). */
  onToken: (token: string | null) => void;
  /** Avisa se o anti-bot está ligado (sem chave configurada, não precisa de token). */
  onReady?: (required: boolean) => void;
}

/**
 * Anti-bot da Cloudflare na criação de conta. Só aparece se o servidor tiver as chaves configuradas
 * (GET /api/config); desligado, não renderiza nada e a conta é criada sem token.
 */
export default function Turnstile({ onToken, onReady }: Props) {
  const { t, lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    fetchConfig()
      .then(async ({ turnstileSiteKey }) => {
        onReady?.(Boolean(turnstileSiteKey));
        if (!turnstileSiteKey || cancelled) return;
        await loadScript();
        if (cancelled || !box.current || !window.turnstile) return;
        widgetId = window.turnstile.render(box.current, {
          sitekey: turnstileSiteKey,
          theme: 'dark',
          language: lang === 'pt' ? 'pt-br' : 'en',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // O widget é montado uma vez por tela; os callbacks não mudam.
  }, []);

  return (
    <div className="turnstile">
      <div ref={box} />
      {failed && <p className="muted">{t('turnstile.failed')}</p>}
    </div>
  );
}
