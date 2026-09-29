// Busca a imagem de cada personagem sem `image` e salva em public/chars/<id>.webp (240px de largura),
// gravando o caminho em data/characters.json. A fonte depende da categoria:
//   anime → AniList (API pública)
//   games → imagem do artigo da Wikipédia (inglês) indicado em "wikipedia"; sem ele, IGDB
//           (precisa de IGDB_CLIENT_ID e IGDB_CLIENT_SECRET no .env; ver README). O IGDB tem poucos retratos.
//   Sem nenhuma fonte: baixe a imagem no navegador e use `npm run import:image -- <id> <arquivo>`.
// Marca com ⚠ quando o personagem encontrado parece não ser o certo (nome ou obra diferentes).
//
// Uso: npm run fetch:images            (só os que não têm imagem)
//      npm run fetch:images -- goku     (força ids específicos)
//
// Se a busca não achar o personagem, adicione "search" (nome como na fonte) no JSON;
// se achar o errado, fixe "anilistId" / "igdbId". Depois rode de novo.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveImage } from './lib/images.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/characters.json');
const characters = JSON.parse(readFileSync(dataPath, 'utf8'));
const forced = new Set(process.argv.slice(2));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Normaliza títulos para comparar romanizações ("Shippuuden" = "Shippuden"). */
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/ou/g, 'o')
    .replace(/([aeiou])\1/g, '$1');

/** Tokens de nome comparáveis entre romanizações ("Yuuji" = "Yuji", "Gojou" = "Gojo"). */
function nameTokens(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .map((t) => t.replace(/ou/g, 'o').replace(/([aeiou])\1/g, '$1'))
    .filter((t) => t.length > 1);
}

const sameName = (ours, candidateNames) => {
  const theirs = new Set(candidateNames.filter(Boolean).flatMap(nameTokens));
  return nameTokens(ours).some((t) => theirs.has(t));
};

/** Chave da obra: título antes do subtítulo ("Fullmetal Alchemist: Brotherhood"), a não ser que fique curto ("Re:Zero"). */
function seriesKey(series) {
  const head = normalize(series.split(/[:(]/)[0]);
  return head.length >= 4 ? head : normalize(series);
}

/**
 * Uma fonte recebe o personagem e devolve o melhor candidato:
 * { sourceId, name, altNames, imageUrl, inSeries } ou null.
 */
const sources = {
  anime: {
    idField: 'anilistId',
    label: 'AniList',
    delayMs: 800, // AniList permite ~90 req/min (às vezes 30)
    async find(c) {
      const query = `
        query ($id: Int, $search: String) {
          Page(perPage: 25) {
            characters(id: $id, search: $search) {
              id
              name { full alternative }
              image { large }
              media(perPage: 10) { nodes { title { romaji english } } }
            }
          }
        }`;
      const variables = c.anilistId ? { id: c.anilistId } : { search: c.search ?? c.name };
      const results = await withRetry('AniList', () =>
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
        }),
      ).then((json) => json.data.Page.characters);

      const key = seriesKey(c.series);
      const inSeries = (r) =>
        r.media.nodes.some((m) => [m.title.romaji, m.title.english].some((t) => t && normalize(t).includes(key)));
      const match = results.find(inSeries) ?? results[0];
      if (!match?.image?.large) return null;
      return {
        sourceId: match.id,
        name: match.name.full,
        altNames: match.name.alternative ?? [],
        imageUrl: match.image.large,
        inSeries: inSeries(match),
      };
    },
  },

  games: {
    idField: 'igdbId',
    label: 'IGDB',
    delayMs: 300, // IGDB permite 4 req/s
    async find(c) {
      if (c.wikipedia) return findOnWikipedia(c);
      const token = await igdbToken();
      const escaped = (c.search ?? c.name).replace(/"/g, '\\"');
      const body = c.igdbId
        ? `fields name, akas, mug_shot.image_id, games.name; where id = ${c.igdbId};`
        : `fields name, akas, mug_shot.image_id, games.name; search "${escaped}"; limit 30;`;
      const results = await withRetry('IGDB', () =>
        fetch('https://api.igdb.com/v4/characters', {
          method: 'POST',
          headers: { 'Client-ID': process.env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}` },
          body,
        }),
      );

      // Só servem candidatos com retrato; entre eles, prefere quem aparece num jogo da franquia.
      const key = seriesKey(c.series);
      const inSeries = (r) => (r.games ?? []).some((g) => normalize(g.name).includes(key));
      const withImage = results.filter((r) => r.mug_shot?.image_id);
      const match = withImage.find(inSeries) ?? withImage[0];
      if (!match) return null;
      return {
        sourceId: match.id,
        name: match.name,
        altNames: match.akas ?? [],
        // t_cover_big = 264x374, o suficiente para os 240px que salvamos.
        imageUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${match.mug_shot.image_id}.jpg`,
        inSeries: inSeries(match),
      };
    },
  },
};

// A Wikimedia exige um User-Agent que identifique o projeto.
const WIKIMEDIA_HEADERS = { 'User-Agent': 'PowerRank/1.0 (https://github.com/guialbertinic/power-rank)' };

/**
 * Imagem principal do artigo da Wikipédia em `c.wikipedia` (título exato). `pilicense=any` inclui as imagens
 * "fair use" dos artigos de personagens, que a API omite por padrão. O artigo é escolhido à mão.
 */
async function findOnWikipedia(c) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(c.wikipedia)}&prop=pageimages&piprop=original&pilicense=any&redirects=1&format=json`;
  const json = await withRetry('Wikipédia', () => fetch(url, { headers: WIKIMEDIA_HEADERS }));
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page?.original?.source) return null;
  return {
    sourceId: null,
    name: page.title,
    altNames: [c.name],
    imageUrl: page.original.source,
    inSeries: true,
    label: 'Wikipédia',
    headers: WIKIMEDIA_HEADERS,
  };
}

/** Faz a requisição com espera em caso de rate limit (429) e devolve o JSON. */
async function withRetry(label, doFetch) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await doFetch();
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? (label === 'IGDB' ? 2 : 60));
      console.log(`  ${label}: rate limit, aguardando ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error(`${label}: muitas tentativas`);
}

/** Token de app da Twitch (client credentials), pedido uma vez por execução. */
let igdbTokenPromise;
function igdbToken() {
  const { IGDB_CLIENT_ID: id, IGDB_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) {
    throw new Error('Faltam IGDB_CLIENT_ID e IGDB_CLIENT_SECRET no arquivo .env (veja o README).');
  }
  igdbTokenPromise ??= fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: 'POST' },
  ).then(async (res) => {
    if (!res.ok) throw new Error(`Twitch OAuth HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()).access_token;
  });
  return igdbTokenPromise;
}

const save = () => writeFileSync(dataPath, JSON.stringify(characters, null, 2) + '\n');

let updated = 0;
for (const c of characters) {
  if (c.image && !forced.has(c.id)) continue;
  if (forced.size && !forced.has(c.id)) continue;

  const source = sources[c.category];
  if (!source) {
    console.warn(`✗ ${c.id}: categoria sem fonte de imagem (${c.category})`);
    continue;
  }

  const pinned = Boolean(c[source.idField] || c.wikipedia);
  const match = await source.find(c);
  if (!match) {
    console.warn(`✗ ${c.id}: não encontrado no ${source.label}`);
    await sleep(source.delayMs);
    continue;
  }

  const img = await fetch(match.imageUrl, { headers: match.headers });
  if (!img.ok) {
    console.warn(`✗ ${c.id}: falha ao baixar imagem (${img.status})`);
    continue;
  }
  c.image = await saveImage(c.id, Buffer.from(await img.arrayBuffer()));
  if (match.sourceId) c[source.idField] = match.sourceId;
  updated++;

  // Com o id fixado no JSON a escolha foi manual, então não há o que conferir.
  const warnings = pinned
    ? []
    : [!sameName(c.name, [match.name, ...match.altNames]) && 'nome diferente', !match.inSeries && 'obra diferente'].filter(
        Boolean,
      );
  const suffix = warnings.length ? ` [${warnings.join(', ')}]` : '';
  const from = match.label ?? `${source.label} ${match.sourceId}`;
  console.log(`${warnings.length ? '⚠' : '✓'} ${c.id} → ${match.name} (${from})${suffix}`);
  if (updated % 10 === 0) save();

  await sleep(source.delayMs);
}

save();
console.log(`\n${updated} imagens atualizadas.`);
