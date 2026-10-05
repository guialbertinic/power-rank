import type { Lang } from './index';

/**
 * O servidor responde sempre em português; aqui o site traduz as mensagens que chegam na tela.
 * Mensagem nova no servidor sem tradução aparece em português no inglês até entrar nesta tabela.
 */
const EXACT_EN: Record<string, string> = {
  // Conta e nick
  'Nick inválido': 'Invalid nick',
  'Nick não verificado': 'Nick not verified',
  'Nick não verificado. Escolha seu nick de novo.': 'Nick not verified. Choose your nick again.',
  'Esse nick já tem dono': 'This nick already has an owner',
  'Esse nick já tem senha': 'This nick already has a password',
  'Esse nick já é de outra conta': 'This nick belongs to another account',
  'Esse nick não é permitido. Escolha outro.': 'This nick is not allowed. Choose another.',
  'Senha incorreta': 'Wrong password',
  'Muitas tentativas. Espere alguns minutos e tente de novo.': 'Too many attempts. Wait a few minutes and try again.',
  'Muitas tentativas seguidas. Espere um minuto e tente de novo.': 'Too many attempts in a row. Wait a minute and try again.',
  'Confirme que você não é um robô.': 'Confirm you are not a robot.',
  'Só para maiores de 18 anos.': 'Adults only (18+).',
  'Esta conta foi suspensa.': 'This account has been suspended.',
  'Essa conta ainda não tem senha': 'This account doesn’t have a password yet',
  'Denúncia inválida': 'Invalid report',
  // Partida
  'Você já jogou o desafio de hoje.': 'You already played today’s challenge.',
  'Categoria inválida': 'Invalid category',
  'Gerações inválidas': 'Invalid generations',
  'Categorias inválidas': 'Invalid categories',
  'Dificuldade inválida': 'Invalid difficulty',
  'Categoria ainda sem personagens suficientes': 'This category doesn’t have enough characters yet',
  'Categoria sem personagens suficientes': 'This category doesn’t have enough characters',
  'Partida inexistente, expirada ou já enviada': 'Game not found, expired or already submitted',
  'Partida rápida demais para valer.': 'Game too fast to count.',
  'Personagem desconhecido': 'Unknown character',
  'Desafio de hoje indisponível': 'Today’s challenge is unavailable',
  'Sem conexão com o servidor. Tente de novo.': 'No connection to the server. Try again.',
  // Auto Battle
  'Moedas da run insuficientes': 'Not enough run coins',
  'Time e banco cheios': 'Team and bench are full',
  'Banco cheio': 'Bench full',
  'Oferta indisponível': 'Offer unavailable',
  'Esse personagem já está no máximo': 'This character is already maxed',
  'Você não tem esse personagem': 'You don’t have this character',
  'Nenhuma run em andamento': 'No run in progress',
  'Ação repetida. Tente de novo.': 'Repeated action. Try again.',
  'Monte um time antes de lutar': 'Build a team before fighting',
  // Party
  'Sala não encontrada': 'Room not found',
  'A partida já começou': 'The game has already started',
  'Esse nick já está na sala': 'This nick is already in the room',
  'Você já está na sala': 'You are already in the room',
  'Identificação inválida': 'Invalid identification',
  'Posições inválidas': 'Invalid positions',
  'Só o dono da sala pode iniciar': 'Only the room host can start',
  'Só o dono da sala pode encerrar': 'Only the room host can end the game',
  'Só o dono da sala pode fazer isso': 'Only the room host can do that',
  'Você foi removido da sala': 'You were removed from the room',
  'Não foi possível criar a sala': "Couldn't create the room",
  'Conexão encerrada pela sala': 'Connection closed by the room',
  'Não foi possível reconectar à sala': "Couldn't reconnect to the room",
  // Admin
  'Acesso negado': 'Access denied',
  'Envie JSON': 'Send JSON',
  'Chave inválida': 'Invalid switch',
  'Quantidade inválida': 'Invalid amount',
  'Informe o motivo': 'Enter the reason',
  'O saldo não pode ficar negativo': 'The balance cannot go negative',
  'Jogador não encontrado': 'Player not found',
  'Prazo inválido': 'Invalid duration',
  'Essa conta não está suspensa': 'This account isn’t suspended',
  'Personagem não encontrado': 'Character not found',
  'Nome inválido': 'Invalid name',
  'Obra inválida': 'Invalid series',
  'Versão inválida': 'Invalid version',
  'Poder inválido (0 a 100)': 'Invalid power (0 to 100)',
  'Fama inválida': 'Invalid fame',
  'Ativo inválido': 'Invalid active flag',
  'Imagem inválida': 'Invalid image',
  'Nada para fechar': 'Nothing to close',
  // Loja e Arcade
  'Este minigame está desligado no momento.': 'This minigame is turned off right now.',
  'Moedas insuficientes': 'Not enough coins',
  'Você já tem esse item': 'You already have this item',
  'Você não tem esse item': 'You don’t have this item',
  'Item inexistente': 'Item not found',
  'Esse item não vai nesse espaço': 'This item doesn’t go in that slot',
  'Aposta inválida': 'Invalid bet',
  'Risco inválido': 'Invalid risk',
  'Erro interno': 'Internal error',
  // Senha (src/game/account.ts)
  'As senhas não são iguais': 'The passwords don’t match',
};

/** Mensagens com partes variáveis (nick, número). */
const PATTERNS_EN: [RegExp, string][] = [
  [/^A senha precisa ter pelo menos (\d+) caracteres$/, 'Password must be at least $1 characters'],
  [/^A senha pode ter até (\d+) caracteres$/, 'Password can be at most $1 characters'],
  [/^Parecido demais com o nick (.+)\. Escolha outro\.$/, 'Too similar to the nick $1. Choose another.'],
  [/^Sala cheia \(máximo (\d+)\)$/, 'Room full (max $1)'],
  [/^Esta conta está suspensa até (\d{2})\/(\d{2})\/(\d{4})\.$/, 'This account is suspended until $3-$2-$1.'],
];

/** Mensagem do servidor no idioma da tela. */
export function serverText(message: string, lang: Lang): string {
  if (lang === 'pt') return message;
  if (message in EXACT_EN) return EXACT_EN[message];
  for (const [pattern, text] of PATTERNS_EN) {
    if (pattern.test(message)) return message.replace(pattern, text);
  }
  return message;
}
