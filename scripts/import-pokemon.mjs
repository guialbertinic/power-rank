// Cria em data/characters.json as entradas dos Pokémon (todas as espécies, forma padrão) a partir da PokeAPI.
// Pokémon novo ganha uma proposta de `power` na escala universal (de lore): legendários e casos conhecidos pela
// tabela LORE abaixo, o resto pelo total de status base. Quem já está no JSON mantém o `power` (pode ter sido
// revisado em /?review); só nome, geração e pokeapiId são atualizados.
// As imagens vêm depois, com `npm run fetch:images` (arte oficial da PokeAPI).
//
// Uso: npm run pokemon:import
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'data/characters.json');
const characters = JSON.parse(readFileSync(dataPath, 'utf8'));

/**
 * Poder de lore proposto (0–100) por espécie. Escala: 0–15 humano · 15–40 sobre-humano · 40–60 prédio→cidade ·
 * 60–75 cidade→montanha · 75–85 ilha→continente · 85–95 planeta→estrela · 95–100 galáxia+.
 */
const LORE = {
  // Criadores e divindades
  arceus: 100, dialga: 97, palkia: 97, giratina: 96,
  necrozma: 90, solgaleo: 88, lunala: 88, eternatus: 88, terapagos: 86,
  rayquaza: 86, kyogre: 84, groudon: 84, kyurem: 83, regigigas: 82,
  reshiram: 82, zekrom: 82, xerneas: 82, yveltal: 82, mew: 82,
  mewtwo: 80, zygarde: 80, zacian: 80, zamazenta: 80, lugia: 78, calyrex: 76,
  'ho-oh': 76, celebi: 74, deoxys: 74, hoopa: 74, jirachi: 72,
  uxie: 70, mesprit: 70, azelf: 70, koraidon: 70, miraidon: 70,
  // Legendários menores
  darkrai: 66, marshadow: 64, cresselia: 62, latios: 62, landorus: 62, tornadus: 60, thundurus: 60, enamorus: 60,
  articuno: 62, zapdos: 62, moltres: 62, latias: 60, entei: 60, raikou: 58, suicune: 58,
  'tapu-koko': 60, 'tapu-lele': 60, 'tapu-bulu': 60, 'tapu-fini': 60,
  glastrier: 60, spectrier: 60, heatran: 58, cobalion: 58, terrakion: 58, virizion: 58,
  'wo-chien': 58, 'chien-pao': 58, 'ting-lu': 58, 'chi-yu': 58, volcanion: 58, zeraora: 58,
  registeel: 56, regirock: 55, regice: 55, regieleki: 56, regidrago: 56, genesect: 56,
  magearna: 55, zarude: 55, urshifu: 55, ogerpon: 55, keldeo: 52, silvally: 52, melmetal: 52,
  victini: 50, diancie: 50, okidogi: 50, munkidori: 50, fezandipiti: 50, pecharunt: 50,
  manaphy: 45, shaymin: 45, meloetta: 45, 'type-null': 45, kubfu: 35, cosmoem: 30, phione: 25,
  cosmog: 18, meltan: 18,
  // Casos conhecidos fora dos status
  alakazam: 46, gengar: 44, dragonite: 50, tyranitar: 50, slaking: 42, wailord: 40, ditto: 20,
  magikarp: 3, feebas: 3, shedinja: 12, unown: 15,
};

/** Status base → escala de lore: 180 ≈ 2 (insetinho), 300 ≈ 15, 400 ≈ 26, 500 ≈ 37, 600 ≈ 48. */
const fromStats = (total) => Math.round(Math.min(58, Math.max(1, 2 + (total - 180) * 0.11)) * 10) / 10;

const query = `{
  pokemonspecies(order_by: { id: asc }) {
    id name generation_id is_legendary is_mythical
    pokemonspeciesnames(where: { language_id: { _eq: 9 } }) { name }
    pokemons(where: { is_default: { _eq: true } }) { id pokemonstats { base_stat } }
  }
}`;
const res = await fetch('https://graphql.pokeapi.co/v1beta2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!res.ok) throw new Error(`PokeAPI ${res.status}`);
const species = (await res.json()).data.pokemonspecies;

const byId = new Map(characters.map((c) => [c.id, c]));
let added = 0;
const guessed = [];
for (const s of species) {
  const id = `pkm-${s.name}`;
  const name = s.pokemonspeciesnames[0]?.name ?? s.name;
  const pokemon = s.pokemons[0];
  const existing = byId.get(id);
  if (existing) {
    Object.assign(existing, { name, generation: s.generation_id, pokeapiId: pokemon.id });
    continue;
  }
  const total = pokemon.pokemonstats.reduce((sum, st) => sum + st.base_stat, 0);
  let power = LORE[s.name];
  if (power === undefined) {
    power = fromStats(total);
    if (s.is_legendary || s.is_mythical) guessed.push(`${id} (${total})`);
  }
  const entry = { id, name, category: 'pokemon', series: 'Pokémon', generation: s.generation_id, power, pokeapiId: pokemon.id };
  characters.push(entry);
  byId.set(id, entry);
  added++;
}

for (const key of Object.keys(LORE)) if (!byId.has(`pkm-${key}`)) console.warn(`⚠ LORE sem espécie: ${key}`);
if (guessed.length) console.warn(`⚠ Legendários sem valor em LORE (usaram os status): ${guessed.join(', ')}`);

// Mesma ordem do resto do arquivo: power desc.
characters.sort((a, b) => b.power - a.power);
writeFileSync(dataPath, JSON.stringify(characters, null, 2) + '\n');
console.log(`${species.length} espécies, ${added} novas.`);
