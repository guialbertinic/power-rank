import type { CharacterInfo } from '../game/types';
import { characterImageUrl, fallbackHue, initials } from './fallback';
import { tierForPosition } from './tiers';

/** Tamanho de story/TikTok (9:16). */
const WIDTH = 1080;
const HEIGHT = 1920;
const PAD = 72;

export interface ShareRow {
  character: CharacterInfo;
  /** Posição correta (1 = mais forte; empates dividem o número). */
  correctPosition: number;
  /** Nível de acerto 0–4 (mesmas cores da comparação do resultado). */
  hit: number;
}

export interface ShareImageData {
  nick: string;
  modeLabel: string;
  score: number;
  maxScore: number;
  rankTitle: string;
  /** Na ordem em que o jogador colocou (posição 1 primeiro). */
  rows: ShareRow[];
  labels: { yours: string; correct: string };
  /** Endereço do site no rodapé (ex: "powerrank.gg"). */
  site: string;
}

/** Valor de um token de `tokens.css` (o canvas não entende `var()`). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = url;
  return img.decode().then(
    () => img,
    () => null,
  );
}

/** Polígono chanfrado (cantos superior esquerdo e inferior direito cortados), como o `--clip-chamfer`. */
function chamferPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

/** Paralelogramo inclinado, como o `--clip-slant` dos botões e badges. */
function slantPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const s = w * 0.1;
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - s, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

/** Corta o texto com "…" até caber na largura. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Desenha a imagem para compartilhar (ranking do jogador + pontuação + nick) e devolve o PNG.
 * As imagens dos personagens são do próprio site (mesma origem), então o canvas não fica "sujo" para exportar.
 */
export async function renderShareImage(data: ShareImageData): Promise<Blob> {
  const display = token('--font-display');
  const body = token('--font-body');
  const color = {
    bg: token('--bg'),
    surface2: token('--surface-2'),
    border: token('--border'),
    grid: token('--grid-line'),
    text: token('--text'),
    text2: token('--text-2'),
    accent: token('--accent'),
    accent2: token('--accent-2'),
    hits: [token('--tier-c'), token('--tier-a'), token('--hit-mid'), token('--tier-s'), token('--tier-d')],
  };
  // O canvas não espera a fonte: carrega antes de desenhar (sem ela, cai na fonte padrão).
  await Promise.all(
    [`italic 700 40px ${display}`, `700 40px ${display}`, `700 40px ${body}`, `600 40px ${body}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
  const images = await Promise.all(
    data.rows.map((r) => {
      const url = characterImageUrl(r.character);
      return url ? loadImage(url) : Promise.resolve(null);
    }),
  );

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  // Fundo com a grade do site e um brilho da cor de destaque no topo.
  ctx.fillStyle = color.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = color.grid;
  ctx.lineWidth = 2;
  for (let x = 0; x <= WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(WIDTH / 2, 0, 0, WIDTH / 2, 0, 900);
  glow.addColorStop(0, `${color.accent}55`);
  glow.addColorStop(1, `${color.accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, 900);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Cabeçalho: nome do jogo, modo e nick.
  ctx.fillStyle = color.text;
  ctx.font = `italic 700 88px ${display}`;
  ctx.fillText('POWER RANK', WIDTH / 2, 160);
  ctx.fillStyle = color.text2;
  ctx.font = `700 38px ${display}`;
  ctx.fillText(data.modeLabel.toUpperCase(), WIDTH / 2, 220);
  ctx.fillStyle = color.text;
  ctx.font = `700 52px ${body}`;
  ctx.fillText(fit(ctx, data.nick, WIDTH - PAD * 2), WIDTH / 2, 310);

  // Pontuação: número grande + "/1000" menor, centralizados juntos.
  ctx.font = `italic 700 190px ${display}`;
  const scoreText = String(data.score);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.font = `700 60px ${display}`;
  const maxText = `/${data.maxScore}`;
  const maxWidth = ctx.measureText(maxText).width;
  const scoreX = (WIDTH - scoreWidth - maxWidth) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = color.text;
  ctx.font = `italic 700 190px ${display}`;
  ctx.fillText(scoreText, scoreX, 510);
  ctx.fillStyle = color.text2;
  ctx.font = `700 60px ${display}`;
  ctx.fillText(maxText, scoreX + scoreWidth, 510);

  // Título da pontuação num badge inclinado com o gradiente de destaque.
  ctx.font = `italic 700 44px ${display}`;
  const title = data.rankTitle.toUpperCase();
  const badgeW = ctx.measureText(title).width + 110;
  const badgeX = (WIDTH - badgeW) / 2;
  const fill = ctx.createLinearGradient(badgeX, 560, badgeX + badgeW, 630);
  fill.addColorStop(0, color.accent);
  fill.addColorStop(1, color.accent2);
  ctx.fillStyle = fill;
  slantPath(ctx, badgeX, 560, badgeW, 70);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(title, WIDTH / 2, 612);

  // Rótulos das colunas.
  const rowsTop = 740;
  const rowH = 96;
  const gap = 8;
  ctx.font = `700 30px ${display}`;
  ctx.fillStyle = color.text2;
  ctx.textAlign = 'left';
  ctx.fillText(data.labels.yours.toUpperCase(), PAD, rowsTop - 24);
  ctx.textAlign = 'right';
  ctx.fillText(data.labels.correct.toUpperCase(), WIDTH - PAD, rowsTop - 24);

  data.rows.forEach((row, i) => {
    const y = rowsTop + i * (rowH + gap);
    const w = WIDTH - PAD * 2;
    const hitColor = color.hits[row.hit] ?? color.text2;

    chamferPath(ctx, PAD, y, w, rowH, 14);
    ctx.fillStyle = color.surface2;
    ctx.fill();
    ctx.strokeStyle = color.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Barra de acerto na esquerda.
    ctx.fillStyle = hitColor;
    ctx.fillRect(PAD, y + 14, 8, rowH - 14);

    // Posição do jogador, na cor do tier da posição (como o RankBadge).
    const tier = tierForPosition(i + 1);
    ctx.fillStyle = token(`--tier-${tier}`);
    slantPath(ctx, PAD + 26, y + 22, 76, 52);
    ctx.fill();
    ctx.fillStyle = tier === 'b' ? '#fff' : color.bg;
    ctx.font = `italic 700 36px ${display}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), PAD + 64, y + 61);

    // Retrato chanfrado (ou iniciais sobre o gradiente do placeholder).
    const ax = PAD + 120;
    const ay = y + 10;
    const size = rowH - 20;
    ctx.save();
    chamferPath(ctx, ax, ay, size, size, 10);
    ctx.clip();
    const img = images[i];
    if (img) {
      // "cover": corta o excesso mantendo o centro-topo (rosto).
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const sw = size / scale;
      const sh = size / scale;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, 0, sw, sh, ax, ay, size, size);
    } else {
      const hue = fallbackHue(row.character.id);
      const g = ctx.createLinearGradient(ax, ay, ax + size, ay + size);
      g.addColorStop(0, `hsl(${hue} 70% 45%)`);
      g.addColorStop(1, `hsl(${(hue + 40) % 360} 70% 25%)`);
      ctx.fillStyle = g;
      ctx.fillRect(ax, ay, size, size);
      ctx.fillStyle = '#fff';
      ctx.font = `700 30px ${display}`;
      ctx.fillText(initials(row.character.name), ax + size / 2, ay + size / 2 + 11);
    }
    ctx.restore();

    // Posição correta à direita, na cor do acerto.
    ctx.textAlign = 'right';
    ctx.fillStyle = hitColor;
    ctx.font = `italic 700 46px ${display}`;
    ctx.fillText(`#${row.correctPosition}`, WIDTH - PAD - 28, y + 64);

    // Nome e obra.
    const textX = ax + size + 24;
    const textMax = WIDTH - PAD - 130 - textX;
    ctx.textAlign = 'left';
    ctx.fillStyle = color.text;
    ctx.font = `700 40px ${body}`;
    ctx.fillText(fit(ctx, row.character.name, textMax), textX, y + 46);
    ctx.fillStyle = color.text2;
    ctx.font = `600 28px ${body}`;
    ctx.fillText(fit(ctx, row.character.series, textMax), textX, y + 80);
  });

  // Rodapé com o endereço do site.
  ctx.textAlign = 'center';
  ctx.fillStyle = color.text2;
  ctx.font = `700 36px ${display}`;
  ctx.fillText(data.site, WIDTH / 2, HEIGHT - 70);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar a imagem'))), 'image/png'),
  );
}
