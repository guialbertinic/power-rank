// Busca a imagem de cada personagem sem `image` na API pública do AniList,
// salva em public/chars/<id>.webp (240px de largura) e grava o caminho em data/characters.json.
// Marca com ⚠ quando o personagem encontrado parece não ser o certo (nome ou obra diferentes).
//
// Uso: npm run fetch:images            (só os que não têm imagem)
//      npm run fetch:images -- goku     (força ids específicos)
//
// Se o AniList não achar o personagem, adicione "search" (nome como no AniList) no JSON;
// se achar o errado, adicione "anilistId". Depois rode de novo.
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/characters.json');
const charsDir = join(root, 'public/chars');
const characters = JSON.parse(readFileSync(dataPath, 'utf8'));
const forced = new Set(process.argv.slice(2));

const QUERY = `
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Normaliza títulos para comparar romanizações ("Shippuuden" = "Shippuden"). */
const normalize = (s) =>
  s
    .toLowerCase()
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

function sameName(ours, match) {
  const theirs = new Set([match.name.full, ...(match.name.alternative ?? [])].filter(Boolean).flatMap(nameTokens));
  return nameTokens(ours).some((t) => theirs.has(t));
}

async function anilist(variables) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables }),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 60);
      console.log(`  rate limit, aguardando ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
    return (await res.json()).data.Page.characters;
  }
  throw new Error('AniList: muitas tentativas');
}

/** Prefere o resultado que aparece em uma obra cujo título bate com `anime`. */
function pickMatch(results, anime) {
  // Usa o título antes do subtítulo ("Fullmetal Alchemist: Brotherhood"), a não ser que fique curto demais ("Re:Zero").
  const head = normalize(anime.split(/[:(]/)[0]);
  const key = head.length >= 4 ? head : normalize(anime);
  const inAnime = results.find((r) =>
    r.media.nodes.some((m) => [m.title.romaji, m.title.english].some((t) => t && normalize(t).includes(key))),
  );
  return { match: inAnime ?? results[0], inAnime: Boolean(inAnime) };
}

/** Converte para WebP e apaga versões antigas do mesmo personagem (jpg/png). */
async function saveImage(id, buffer) {
  for (const f of readdirSync(charsDir)) {
    if (f.startsWith(`${id}.`) && !f.endsWith('.webp')) unlinkSync(join(charsDir, f));
  }
  await sharp(buffer)
    .resize({ width: 240, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(join(charsDir, `${id}.webp`));
  return `chars/${id}.webp`;
}

const save = () => writeFileSync(dataPath, JSON.stringify(characters, null, 2) + '\n');

let updated = 0;
for (const c of characters) {
  if (c.image && !forced.has(c.id)) continue;
  if (forced.size && !forced.has(c.id)) continue;

  const pinned = Boolean(c.anilistId);
  const results = await anilist(pinned ? { id: c.anilistId } : { search: c.search ?? c.name });
  const { match, inAnime } = results.length ? pickMatch(results, c.anime) : {};
  if (!match?.image?.large) {
    console.warn(`✗ ${c.id}: não encontrado`);
    continue;
  }

  const img = await fetch(match.image.large);
  if (!img.ok) {
    console.warn(`✗ ${c.id}: falha ao baixar imagem (${img.status})`);
    continue;
  }
  c.image = await saveImage(c.id, Buffer.from(await img.arrayBuffer()));
  c.anilistId = match.id;
  updated++;

  // Com anilistId fixado no JSON a escolha foi manual, então não há o que conferir.
  const warnings = pinned ? [] : [!sameName(c.name, match) && 'nome diferente', !inAnime && 'obra diferente'].filter(Boolean);
  const suffix = warnings.length ? ` [${warnings.join(', ')}]` : '';
  console.log(`${warnings.length ? '⚠' : '✓'} ${c.id} → ${match.name.full} (AniList ${match.id})${suffix}`);
  if (updated % 10 === 0) save();

  await sleep(800); // AniList permite ~90 req/min
}

save();
console.log(`\n${updated} imagens atualizadas.`);
