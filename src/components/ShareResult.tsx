import { useEffect, useMemo, useState } from 'react';
import { MODES, type Mode } from '../game/modes';
import { MAX_SCORE, rankLevel, scoreGame, withRanks } from '../game/scoring';
import type { CharacterInfo } from '../game/types';
import { useI18n } from '../i18n';
import { HIT_EMOJI, hitLevel } from '../ui/hits';
import { renderShareImage } from '../ui/shareImage';

interface Props {
  mode: Mode;
  nick: string;
  slots: CharacterInfo[];
  ranks: Record<string, number>;
  score: number;
  /** Partida do Desafio Diário: aparece como "Desafio diário" no lugar da categoria. */
  daily?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Compartilhar: imagem pronta para story/TikTok (ranking + pontuação + nick) e o resultado em texto estilo Wordle
 * (pontuação + um quadrado de acerto por posição + link, sem nomes: não dá spoiler da ordem).
 * A imagem é gerada assim que o resultado chega: o `navigator.share` precisa ser chamado logo no clique
 * (o navegador recusa se o clique ficou "velho" esperando o canvas).
 */
export default function ShareResult({ mode, nick, slots, ranks, score, daily = false }: Props) {
  const { t, lang } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [copy, setCopy] = useState<CopyState>('idle');

  const modeLabel = daily ? t('intro.daily') : (MODES.find((m) => m.id === mode)?.label ?? '');
  const rows = useMemo(() => {
    const { results } = scoreGame(withRanks(slots, ranks));
    return results.map((r) => ({
      character: r.character,
      correctPosition: (ranks[r.character.id] ?? 0) + 1,
      hit: hitLevel(r.pairsTotal - r.pairsRight),
    }));
  }, [slots, ranks]);

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setImageFailed(false);
    renderShareImage({
      nick,
      modeLabel,
      score,
      maxScore: MAX_SCORE,
      rankTitle: t(`rank.${rankLevel(score)}`),
      rows,
      labels: { yours: t('result.yours'), correct: t('result.correct') },
      site: window.location.host,
    })
      .then((blob) => {
        if (!cancelled) setFile(new File([blob], `power-rank-${score}.png`, { type: 'image/png' }));
      })
      .catch(() => {
        if (!cancelled) setImageFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // O idioma muda os rótulos da imagem: gera de novo.
  }, [rows, nick, modeLabel, score, lang]);

  const text = [
    t('share.text', { score, max: MAX_SCORE, mode: modeLabel, title: t(`rank.${rankLevel(score)}`) }),
    rows.map((r) => HIT_EMOJI[r.hit]).join(''),
    window.location.origin,
  ].join('\n');

  // Com Web Share de arquivos (celular, Edge no Windows): abre o menu do sistema. Senão, baixa o PNG.
  async function shareImage() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
      } catch {
        // Cancelado pelo jogador ou recusado: nada a fazer.
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    setTimeout(() => setCopy('idle'), 2000);
  }

  return (
    <div className="share-result">
      <button
        className="btn btn-sm btn-secondary share-image"
        onClick={shareImage}
        disabled={!file}
        aria-busy={!file && !imageFailed}
      >
        {t('share.image')}
      </button>
      <button className="btn btn-sm btn-ghost share-text" onClick={shareText}>
        {copy === 'copied' ? t('share.copied') : copy === 'failed' ? t('share.copyFailed') : t('share.result')}
      </button>
    </div>
  );
}
