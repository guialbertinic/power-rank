import type { SymbolId } from '../game/casino';
import { SYMBOLS_BY_ID } from '../game/casino';
import type { Cosmetic } from '../game/cosmetics';
import type { Lang } from './index';

/**
 * Nomes do catálogo em inglês, por id (o português é o `label` do próprio catálogo). Item novo sem tradução
 * aparece em português no inglês até entrar aqui.
 */
const COSMETICS_EN: Record<string, string> = {
  // Cores do nick
  'name-cyan': 'Neon Cyan',
  'name-pink': 'Aura Pink',
  'name-green': 'Energy',
  'name-gold': 'Gold',
  'name-fire': 'Fire',
  'name-rainbow': 'Prism',
  'name-sharingan': 'Sharingan',
  'name-susanoo': 'Susanoo',
  'name-rasengan': 'Rasengan',
  'name-ice': 'Ice',
  'name-sakura': 'Sakura',
  'name-venom': 'Venom',
  'name-sunset': 'Sunset',
  'name-lightning': 'Lightning',
  'name-glitch': 'Glitch',
  'name-holo': 'Holographic',
  'name-aurora': 'Aurora',
  'name-blackgold': 'Black Gold',
  'name-neonpulse': 'Neon Pulse',
  // Molduras
  'frame-steel': 'Steel',
  'frame-neon': 'Neon',
  'frame-aura': 'Pulsing Aura',
  'frame-flame': 'Golden Flame',
  'frame-legend': 'Legendary',
  'frame-bronze': 'Bronze',
  'frame-sakura': 'Sakura',
  'frame-ice': 'Ice',
  'frame-venom': 'Venom',
  'frame-lightning': 'Lightning',
  'frame-sharingan': 'Sharingan',
  'frame-galaxy': 'Galaxy',
  'frame-dragon': 'Dragon',
  'frame-masterball': 'Master Ball',
  'frame-gamecorner': 'Game Corner',
  'frame-holo': 'Holographic',
  // Títulos
  'title-iniciante-prospero': 'Prosperous Beginner',
  'title-novato-promissor': 'Promising Rookie',
  'title-chutador-profissional': 'Professional Guesser',
  'title-so-mais-uma': 'Just One More Game',
  'title-mestre-dos-animes': 'Anime Master',
  'title-senhor-das-waifus': 'Lord of the Waifus',
  'title-rei-dos-husbandos': 'King of the Husbandos',
  'title-otaku-de-carteirinha': 'Card-Carrying Otaku',
  'title-power-scaling': 'Power Scaling Expert',
  'title-chapeu-de-palha': 'Straw Hat Crew Member',
  'title-decima-primeira-espada': 'Captain of the 11th Squad',
  'title-akatsuki': 'Akatsuki Member',
  'title-hashira': 'Demon Slayer Corps Hashira',
  'title-tropa-de-exploracao': 'Survey Corps',
  'title-usuario-de-stand': 'Stand User',
  'title-heroi-classe-s': 'S-Class Hero',
  'title-alquimista-federal': 'State Alchemist',
  'title-mago-fairy-tail': 'Fairy Tail Wizard',
  'title-cacador-licenciado': 'Licensed Hunter',
  'title-keyblade': 'Keyblade Wielder',
  'title-soldado-primeira-classe': 'SOLDIER First Class',
  'title-guardiao-da-triforce': 'Triforce Guardian',
  'title-morri-mil-vezes': 'Died a Thousand Times',
  'title-deus-da-destruicao': 'God of Destruction',
  'title-ultra-instinto': 'Ultra Instinct',
  'title-o-mais-forte': 'The Strongest of Today',
  'title-rei-dos-piratas': 'King of the Pirates',
  'title-sortudo-game-corner': 'Game Corner Lucky Shot',
  'title-viciado-em-gacha': 'Gacha Addict',
  'title-tirou-o-lendario': 'Pulled a Legendary',
  'title-mestre-da-sorte': 'Master of Luck',
};

const SYMBOLS_EN: Record<SymbolId, string> = {
  seven: '7',
  galactic: 'Galactic',
  replay: 'Replay',
  cherry: 'Cherries',
  pikachu: 'Pikachu',
  moonstone: 'Moon Stone',
};

/** Nome de uma cor/moldura/título no idioma. */
export function cosmeticLabel(item: Cosmetic, lang: Lang): string {
  return lang === 'en' ? (COSMETICS_EN[item.id] ?? item.label) : item.label;
}

/** Nome de um símbolo do caça-níquel no idioma. */
export function symbolLabel(id: SymbolId, lang: Lang): string {
  return lang === 'en' ? SYMBOLS_EN[id] : SYMBOLS_BY_ID.get(id)!.label;
}
