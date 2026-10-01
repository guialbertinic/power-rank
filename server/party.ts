import { DurableObject } from 'cloudflare:workers';
import { logAccess } from './access';
import { loadCatalog } from './catalog';
import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { playerAccess } from './players';
import { MIN_GAME_MS, nickProblem } from './security';
import { creditCoins, lookOf } from './profile';
import { EMPTY_LOOK, type Look } from '../src/game/cosmetics';
import { coinsForScore, podiumBonus } from '../src/game/economy';
import { drawCharacters } from '../src/game/draw';
import { isMode, parseGenerations, poolFor, type Mode } from '../src/game/modes';
import {
  isPartyCode,
  podiumOrder,
  PARTY_CODE_ALPHABET,
  PARTY_CODE_LENGTH,
  PARTY_MAX_PLAYERS,
  type ClientMessage,
  type PartyPhase,
  type PartyState,
  type ServerMessage,
} from '../src/game/party';
import { scoreGame, SLOTS, strengthRanks, withRanks } from '../src/game/scoring';

/** Sala sem ninguém conectado é apagada depois desse tempo. */
const IDLE_CLEANUP_MS = 30 * 60 * 1000;

interface StoredPlayer {
  /** Id secreto, gerado no navegador e guardado só na aba do jogador. Permite reconectar na mesma vaga. */
  pid: string;
  /** Id público, o único que vai para os outros jogadores. */
  id: string;
  name: string;
  connected: boolean;
  progress: number;
  finished: boolean;
  score?: number;
  placements?: string[];
  finishedAt?: number;
  /** Visual equipado (lido do perfil ao entrar na sala). */
  look: Look;
  /** Conta do jogador; null = convidado (nick sem conta, não ganha moedas). */
  playerId: number | null;
  /** Moedas ganhas na rodada (pontuação + bônus de pódio). */
  coinsEarned?: number;
  /** Terminou rápido demais (script): sem moedas e fora do ranking. */
  tooFast?: boolean;
}

interface StoredRoom {
  code: string;
  mode: Mode;
  /** Filtro de gerações (modo pokemon); ausente = todas. */
  generations?: number[];
  phase: PartyPhase;
  round: number;
  hostPid: string;
  characterIds: string[];
  players: StoredPlayer[];
  createdAt: number;
  /** Início da rodada atual (mede o tempo de cada jogador para o desempate do ranking). */
  startedAt?: number;
  /**
   * Posição relativa dos sorteados (quantos são mais fortes que cada um), calculada no início da rodada: pontua
   * os jogadores sem consultar o banco no meio da partida e vai para o site só no pódio (nunca o `power`).
   */
  ranks?: Record<string, number>;
}

const isPid = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{8,64}$/.test(value);

/**
 * Uma sala da Party. Cada código de sala vira um Durable Object (idFromName(code)), com os jogadores
 * conectados por WebSocket (API de hibernação: a sala não fica cobrando tempo enquanto ninguém fala).
 * Cada mudança de estado é salva no storage e transmitida a todos.
 */
export class PartyRoom extends DurableObject<Env> {
  /** Cache do estado; `undefined` = ainda não carregado desde que o objeto acordou. */
  private room: StoredRoom | null | undefined;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/init') return this.init(request);
    if (request.headers.get('Upgrade') === 'websocket') return this.openSocket(request, url);
    return json({ error: 'Not found' }, { status: 404 });
  }

  /** Chamado pelo Worker ao criar a sala. 409 se o código já estiver em uso (o Worker sorteia outro). */
  private async init(request: Request): Promise<Response> {
    const { code, mode, generations, hostPid } = (await request.json()) as {
      code: string;
      mode: Mode;
      generations?: number[];
      hostPid: string;
    };
    if (await this.load()) return json({ error: 'Código em uso' }, { status: 409 });

    this.room = { code, mode, ...(generations ? { generations } : {}), phase: 'lobby', round: 0, hostPid, characterIds: [], players: [], createdAt: Date.now() };
    await this.save();
    // Se o dono nunca conectar, a sala some sozinha.
    await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
    return json({ ok: true });
  }

  private async openSocket(request: Request, url: URL): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    const pid = url.searchParams.get('pid');
    const error = await this.join(server, request, pid, url.searchParams.get('name'), url.searchParams.get('token'));
    if (error) {
      this.send(server, { type: 'error', message: error });
      server.close(4000, error);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Entra (ou reconecta) na sala. Devolve a mensagem de erro, se não puder. */
  private async join(
    ws: WebSocket,
    request: Request,
    pid: string | null,
    rawName: string | null,
    token: string | null,
  ): Promise<string | null> {
    if (!(await this.load())) return 'Sala não encontrada';
    if (!isPid(pid)) return 'Identificação inválida';
    const name = sanitizeName(rawName);

    // Quem ainda não está na sala precisa provar que é dono da conta (token) ou usar um nick sem conta, como
    // convidado. A consulta ao D1 é feita ANTES das checagens: durante uma espera de I/O externo o Durable Object processa outras mensagens, e duas
    // conexões do mesmo jogador (ex: React StrictMode, clique duplo) entrariam as duas.
    const isMember = this.room!.players.some((p) => p.pid === pid);
    const access = isMember || name === null ? null : await playerAccess(this.env, name, token);
    const verified = isMember || access !== null;
    const guestProblem = access?.kind === 'guest' ? nickProblem(access.name) : null;
    const look = access?.kind === 'account' ? await lookOf(this.env, access.id) : EMPTY_LOOK;
    // Conta: vale o nick atual dela (pode ter sido trocado em outro dispositivo).
    const displayName = access?.name ?? name;

    // Daqui até o push não há nenhum await: checagem e inclusão acontecem juntas.
    const room = this.room!;
    const existing = room.players.find((p) => p.pid === pid);
    if (existing) {
      // Reconexão: a conexão antiga (se ainda aberta) é substituída. O pid secreto já identifica a vaga.
      for (const other of this.socketsOf(pid)) if (other !== ws) other.close(4001, 'Conectado em outra aba');
      existing.connected = true;
    } else {
      if (room.phase !== 'lobby') return 'A partida já começou';
      if (room.players.length >= PARTY_MAX_PLAYERS) return `Sala cheia (máximo ${PARTY_MAX_PLAYERS})`;
      if (!displayName) return 'Nick inválido';
      if (!verified || !access) return 'Nick não verificado. Escolha seu nick de novo.';
      if (guestProblem) return guestProblem;
      if (room.players.some((p) => nameKey(p.name) === nameKey(displayName))) return 'Esse nick já está na sala';
      if (access.kind === 'account' && room.players.some((p) => p.playerId === access.id)) return 'Você já está na sala';
      room.players.push({
        pid,
        id: crypto.randomUUID().slice(0, 8),
        name: displayName,
        connected: true,
        progress: 0,
        finished: false,
        look,
        playerId: access.kind === 'account' ? access.id : null,
      });
      // Registro de acesso (abuso/trapaça): só na entrada, não nas reconexões. Em segundo plano, depois da resposta.
      this.ctx.waitUntil(
        logAccess(this.env, request, 'party', { playerId: access.kind === 'account' ? access.id : null, name: displayName }),
      );
    }

    ws.serializeAttachment({ pid });
    this.fixHost(room);
    await this.ctx.storage.deleteAlarm();
    await this.commit();
    return null;
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const pid = this.pidOf(ws);
    const player = room?.players.find((p) => p.pid === pid);
    if (!room || !player) return;

    let message: ClientMessage;
    try {
      message = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }

    // Consulta antes das checagens: durante o await outras mensagens rodam (ex: dois "start" seguidos).
    // Só para o dono (quem pode iniciar): os outros recebem o erro na hora.
    const catalog = message.type === 'start' && room.hostPid === player.pid ? await loadCatalog(this.env) : null;

    const isHost = room.hostPid === player.pid;
    const fail = (text: string) => this.send(ws, { type: 'error', message: text });

    switch (message.type) {
      case 'start': {
        if (!isHost) return fail('Só o dono da sala pode iniciar');
        if (room.phase === 'playing') return;
        const pool = poolFor(room.mode, catalog!.active, room.generations);
        if (pool.length < SLOTS) return fail('Categoria sem personagens suficientes');
        const drawn = drawCharacters(pool, SLOTS);
        room.characterIds = drawn.map((c) => c.id);
        room.ranks = strengthRanks(drawn);
        room.round++;
        room.phase = 'playing';
        room.startedAt = Date.now();
        // Quem saiu da sala não entra na nova partida.
        room.players = room.players
          .filter((p) => p.connected)
          .map(({ pid, id, name, connected, look, playerId }) => ({
            pid,
            id,
            name,
            connected,
            look,
            playerId: playerId ?? null,
            progress: 0,
            finished: false,
          }));
        break;
      }
      case 'progress': {
        if (room.phase !== 'playing' || player.finished) return;
        if (!Number.isInteger(message.placed) || message.placed < 0 || message.placed > SLOTS) return;
        player.progress = message.placed;
        // Progresso é passageiro: só transmite, sem gravar (gravar atrasaria cada clique). Se a sala
        // hibernar, o próximo clique do jogador atualiza de novo.
        this.broadcast();
        return;
      }
      case 'finish': {
        if (room.phase !== 'playing' || player.finished) return;
        const placements = message.placements;
        const valid =
          Array.isArray(placements) &&
          placements.length === room.characterIds.length &&
          new Set(placements).size === placements.length &&
          placements.every((id) => room.characterIds.includes(id));
        if (!valid) return fail('Posições inválidas');

        // Pontuação sempre calculada aqui, nunca vem do cliente.
        // Pelas posições relativas guardadas no início da rodada (mesmo resultado que pelo poder real).
        const score = scoreGame(withRanks(placements.map((id) => ({ id })), room.ranks ?? {})).total;
        // Rápido demais para ser gente: aparece no pódio, mas sem moedas (e sem ranking, ver recordScore).
        const tooFast = room.startedAt !== undefined && Date.now() - room.startedAt < MIN_GAME_MS;
        Object.assign(player, {
          finished: true,
          progress: SLOTS,
          placements,
          score,
          coinsEarned: player.playerId === null || tooFast ? 0 : coinsForScore(score),
          tooFast,
          finishedAt: Date.now(),
        });
        this.ctx.waitUntil(this.recordScore(room.mode, player, room.startedAt));
        this.maybeFinishRound(room);
        break;
      }
      case 'end': {
        if (!isHost) return fail('Só o dono da sala pode encerrar');
        if (room.phase !== 'playing') return;
        this.enterPodium(room);
        break;
      }
      default:
        return;
    }
    await this.commit();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws);
  }

  private async leave(ws: WebSocket): Promise<void> {
    const room = await this.load();
    const pid = this.pidOf(ws);
    if (!room || !pid) return;
    // Se o jogador já reconectou por outra conexão, nada muda.
    if (this.socketsOf(pid).some((other) => other !== ws)) return;

    const player = room.players.find((p) => p.pid === pid);
    if (!player) return;
    player.connected = false;
    if (room.phase === 'lobby') room.players = room.players.filter((p) => p !== player);
    this.fixHost(room);
    if (room.phase === 'playing') this.maybeFinishRound(room);

    if (!room.players.some((p) => p.connected)) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
    }
    await this.commit(ws);
  }

  /** Limpeza da sala abandonada. */
  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length > 0) return;
    await this.ctx.storage.deleteAll();
    this.room = null;
  }

  /** O pódio aparece quando todos os jogadores conectados terminaram (e pelo menos um terminou). */
  private maybeFinishRound(room: StoredRoom) {
    const someoneFinished = room.players.some((p) => p.finished);
    const stillPlaying = room.players.some((p) => p.connected && !p.finished);
    if (room.phase === 'playing' && someoneFinished && !stillPlaying) this.enterPodium(room);
  }

  /** Fim da rodada: mostra o pódio e paga o bônus de colocação (uma vez por rodada, na transição). */
  private enterPodium(room: StoredRoom) {
    room.phase = 'podium';
    const ranking = podiumOrder(this.publicState(room).players);
    ranking.slice(0, 3).forEach((ranked, i) => {
      const bonus = podiumBonus(i + 1, ranking.length, ranked.score ?? 0);
      const player = room.players.find((p) => p.id === ranked.id);
      if (!player || !bonus || player.playerId === null || player.tooFast) return;
      player.coinsEarned = (player.coinsEarned ?? 0) + bonus;
      this.ctx.waitUntil(creditCoins(this.env, player.playerId, bonus));
    });
  }

  /** Se o dono saiu, o jogador conectado mais antigo assume. */
  private fixHost(room: StoredRoom) {
    const host = room.players.find((p) => p.pid === room.hostPid);
    if (host?.connected) return;
    const next = room.players.find((p) => p.connected);
    if (next) room.hostPid = next.pid;
  }

  /** O resultado de cada jogador também vale para o ranking da categoria e rende moedas, como no solo. */
  private async recordScore(mode: Mode, player: StoredPlayer, startedAt: number | undefined) {
    const gameId = crypto.randomUUID();
    const { playerId } = player;
    const coins = playerId === null ? 0 : coinsForScore(player.score ?? 0);
    const now = Date.now();
    const durationMs = startedAt ? (player.finishedAt ?? now) - startedAt : null;
    // Rápido demais para ser gente: o pódio da sala mostra, mas não entra no ranking nem rende moedas.
    if (durationMs !== null && durationMs < MIN_GAME_MS) return;
    try {
      await this.env.DB.batch([
        this.env.DB.prepare(
          'INSERT INTO games (id, character_ids, name, player_id, mode, created_at, submitted) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ).bind(gameId, JSON.stringify(player.placements), player.name, playerId, mode, now),
        this.env.DB.prepare(
          `INSERT INTO scores (game_id, name, name_key, player_id, mode, score, placements, coins, duration_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          gameId,
          player.name,
          nameKey(player.name),
          playerId,
          mode,
          player.score,
          JSON.stringify(player.placements),
          coins,
          durationMs,
          now,
        ),
        // Convidado: nenhuma linha em players tem id NULL, então não credita nada.
        this.env.DB.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').bind(coins, playerId),
      ]);
    } catch (err) {
      console.error('party: falha ao gravar pontuação', err);
    }
  }

  private async load(): Promise<StoredRoom | null> {
    if (this.room === undefined) this.room = (await this.ctx.storage.get<StoredRoom>('room')) ?? null;
    return this.room;
  }

  private async save() {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  /** Salva e envia o estado a todos os conectados (menos `except`, que está fechando). */
  private async commit(except?: WebSocket) {
    await this.save();
    this.broadcast(except);
  }

  private broadcast(except?: WebSocket) {
    const room = this.room;
    if (!room) return;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const player = room.players.find((p) => p.pid === this.pidOf(ws));
      if (player) this.send(ws, { type: 'state', state: this.publicState(room), you: player.id });
    }
  }

  private publicState(room: StoredRoom): PartyState {
    const reveal = room.phase === 'podium';
    return {
      code: room.code,
      mode: room.mode,
      ...(room.generations ? { generations: room.generations } : {}),
      phase: room.phase,
      round: room.round,
      hostId: room.players.find((p) => p.pid === room.hostPid)?.id ?? '',
      characterIds: room.characterIds,
      // A ordem correta só no pódio.
      ...(reveal && room.ranks ? { ranks: room.ranks } : {}),
      // Pontuações, posições e moedas só aparecem no pódio.
      players: room.players.map(
        ({ id, name, connected, progress, finished, look, playerId, score, placements, finishedAt, coinsEarned }) => ({
          id,
          name,
          connected,
          guest: playerId === null,
          progress,
          finished,
          look: look ?? EMPTY_LOOK,
          ...(reveal ? { score, placements, finishedAt, coinsEarned } : {}),
        }),
      ),
    };
  }

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Conexão já fechada.
    }
  }

  private pidOf(ws: WebSocket): string | undefined {
    return (ws.deserializeAttachment() as { pid?: string } | null)?.pid;
  }

  private socketsOf(pid: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => this.pidOf(ws) === pid);
  }
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PARTY_CODE_LENGTH));
  return [...bytes].map((b) => PARTY_CODE_ALPHABET[b % PARTY_CODE_ALPHABET.length]).join('');
}

/**
 * POST /api/party: { mode, pid, generations? } → cria a sala e devolve { code }. O dono entra em seguida pelo
 * WebSocket. `generations`: filtro de gerações do modo pokemon (ignorado nos outros).
 */
export async function createParty(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { mode?: unknown; pid?: unknown; generations?: unknown } | null;
  if (!isMode(body?.mode)) return badRequest('Categoria inválida');
  if (!isPid(body?.pid)) return badRequest('Identificação inválida');
  const generations = body.mode === 'pokemon' ? parseGenerations(body.generations) : undefined;
  if (generations === null) return badRequest('Gerações inválidas');
  if (poolFor(body.mode, (await loadCatalog(env)).active, generations).length < SLOTS) {
    return badRequest('Categoria sem personagens suficientes');
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const room = env.PARTY.get(env.PARTY.idFromName(code));
    const res = await room.fetch('https://party/init', {
      method: 'POST',
      body: JSON.stringify({ code, mode: body.mode, generations, hostPid: body.pid }),
    });
    if (res.ok) return json({ code });
    if (res.status !== 409) return json({ error: 'Não foi possível criar a sala' }, { status: 500 });
  }
  return json({ error: 'Não foi possível criar a sala' }, { status: 503 });
}

/** GET /api/party/:code/ws (upgrade para WebSocket): encaminha para a sala. */
export function connectParty(request: Request, env: Env, code: string): Response | Promise<Response> {
  if (!isPartyCode(code)) return badRequest('Código inválido');
  if (request.headers.get('Upgrade') !== 'websocket') return badRequest('Esperado WebSocket');
  return env.PARTY.get(env.PARTY.idFromName(code)).fetch(request);
}
