// Busca a imagem de cada personagem sem `image` na API pública do AniList,
// salva em public/chars/<id>.<ext> e grava o caminho em data/characters.json.
//
// Uso: npm run fetch:images            (só os que não têm imagem)
//      npm run fetch:images -- goku     (força ids específicos)
//
// Se o AniList não achar o personagem, adicione "search" (nome como no AniList) no JSON;
// se achar o errado, adicione "anilistId". Depois rode de novo.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/characters.json');
const characters = JSON.parse(readFileSync(dataPath, 'utf8'));
const forced = new Set(process.argv.slice(2));

const QUERY = `
query ($id: Int, $search: String) {
  Page(perPage: 10) {
    characters(id: $id, search: $search) {
      id
      name { full }
      image { large }
      media(perPage: 10) { nodes { title { romaji english } } }
    }
  }
}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function anilist(variables) {
  for (let attempt = 0; attempt < 3; attempt++) {
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
  const key = normalize(anime.split(/[:(]/)[0]);
  const inAnime = results.find((r) =>
    r.media.nodes.some((m) => [m.title.romaji, m.title.english].some((t) => t && normalize(t).includes(key))),
  );
  return inAnime ?? results[0];
}

let updated = 0;
for (const c of characters) {
  if (c.image && !forced.has(c.id)) continue;
  if (forced.size && !forced.has(c.id)) continue;

  const results = await anilist(c.anilistId ? { id: c.anilistId } : { search: c.search ?? c.name });
  const match = results.length ? pickMatch(results, c.anime) : null;
  if (!match?.image?.large) {
    console.warn(`✗ ${c.id}: não encontrado`);
    continue;
  }

  const img = await fetch(match.image.large);
  if (!img.ok) {
    console.warn(`✗ ${c.id}: falha ao baixar imagem (${img.status})`);
    continue;
  }
  const ext = match.image.large.split('.').pop().split('?')[0] || 'jpg';
  const file = `chars/${c.id}.${ext}`;
  writeFileSync(join(root, 'public', file), Buffer.from(await img.arrayBuffer()));
  c.image = file;
  c.anilistId = match.id;
  updated++;
  console.log(`✓ ${c.id} → ${match.name.full} (AniList ${match.id})`);

  await sleep(800); // AniList permite ~90 req/min
}

writeFileSync(dataPath, JSON.stringify(characters, null, 2) + '\n');
console.log(`\n${updated} imagens atualizadas.`);
