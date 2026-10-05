import { useEffect, useRef, useState } from 'react';
import { autoBattle, type AutoBattleEnd, type AutoBattleFight, type AutoBattleResponse } from '../../api';
import type { Profile } from '../../game/cosmetics';
import {
  REWARD_BY_WINS,
  buyOffer,
  moveUnit,
  sellUnit,
  type Factors,
  type RunError,
  type RunState,
} from '../../game/autobattle';
import { serverText, useI18n } from '../../i18n';
import type { Identity } from '../../nick';
import Coins from '../Coins';
import AutoBattleArena from './AutoBattleArena';
import AutoBattlePrep from './AutoBattlePrep';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

/** Menor número de vitórias que já paga alguma coisa. */
const FIRST_REWARD = REWARD_BY_WINS.findIndex((coins) => coins > 0);

/**
 * Auto Battle (seção "Mais jogos", só contas): o estado da run vem do servidor e cada ação (comprar, vender, mover,
 * rolar, lutar) devolve a run como ficou. Telas: preparação da rodada, luta e fim da run (abrir o jogo já começa ou retoma a run).
 */
export default function AutoBattle({ identity, profile, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const [run, setRun] = useState<RunState | null>(null);
  const [factors, setFactors] = useState<Factors>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Luta sendo mostrada: a run já avançou no servidor; a tela só passa para ela quando a luta termina. */
  const [fight, setFight] = useState<AutoBattleFight | null>(null);
  const [ended, setEnded] = useState<AutoBattleEnd | null>(null);

  // A run como está na tela (com as ações otimistas já aplicadas), a fila de envios e quantos faltam responder.
  const runRef = useRef<RunState | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);

  const apply = (res: AutoBattleResponse) => {
    runRef.current = res.run;
    setRun(res.run);
    if (res.factors) setFactors(res.factors);
    if (res.battle) setFight(res.battle);
    if (res.ended) {
      setEnded(res.ended);
      if (res.ended.coins !== null) onProfileChange({ ...profile, coins: res.ended.coins });
    }
  };

  /**
   * Envia uma ação ao servidor, uma de cada vez e na ordem dos cliques (a run tem versão: duas ao mesmo tempo, a
   * segunda seria recusada). Com `optimistic` (comprar, vender, mover: o resultado é calculável aqui, com as mesmas
   * funções do servidor), a tela muda na hora e a resposta só confirma; sem ele (rolar, lutar: sorteio do servidor),
   * a tela espera. A resposta só é aplicada quando não há mais nada na fila, para não desfazer cliques posteriores.
   */
  const act = (
    action: Parameters<typeof autoBattle>[1],
    payload?: Parameters<typeof autoBattle>[2],
    optimistic?: RunState,
  ) => {
    if (optimistic) {
      runRef.current = optimistic;
      setRun(optimistic);
    } else {
      setBusy(true);
    }
    setError(null);
    pending.current++;
    queue.current = queue.current.then(async () => {
      try {
        const res = await autoBattle(identity.token, action, payload);
        pending.current--;
        if (pending.current === 0) apply(res);
      } catch (err) {
        pending.current--;
        setError(serverText(err instanceof Error ? err.message : 'Erro interno', lang));
        // A tela pode ter ficado diferente do servidor (ação otimista recusada): relê a run.
        if (optimistic && pending.current === 0) {
          await autoBattle(identity.token, 'state').then(apply, () => {});
        }
      } finally {
        if (!optimistic) setBusy(false);
        setLoaded(true);
      }
    });
  };

  /** Aplica na tela uma ação da loja (se for válida) e manda para o servidor confirmar. */
  const actLocal = (
    action: 'buy' | 'sell' | 'move',
    payload: { offer?: number; id?: string },
    change: (run: RunState) => RunState | RunError,
  ) => {
    const next = runRef.current && change(runRef.current);
    if (next && typeof next !== 'string') act(action, payload, next);
  };

  useEffect(() => {
    // Abrir o jogo já começa a run (ou retoma a que estava em andamento): não há tela de entrada.
    act('start');
  }, []);

  if (!loaded) return <p className="muted ab-loading">{t('app.loading')}</p>;

  if (fight) return <AutoBattleArena fight={fight} factors={factors} nick={identity.name} onDone={() => setFight(null)} />;

  if (ended) {
    return (
      <section className="panel ab-end" data-ab="end">
        <h2 className="section-title">{t(ended.cleared ? 'ab.endCleared' : 'ab.endTitle')}</h2>
        <p className="ab-end-score">{t('ab.endScore', { wins: ended.wins, losses: ended.losses })}</p>
        {ended.reward > 0 ? (
          <p className="ab-end-reward">
            {t('ab.endReward')} <Coins amount={ended.reward} prefix="+" />
          </p>
        ) : (
          <p className="muted">{t('ab.endNoReward', { n: FIRST_REWARD })}</p>
        )}
        <button
          className="btn btn-primary"
          data-ab="start"
          onClick={() => {
            setEnded(null);
            act('start');
          }}
          disabled={busy}
        >
          {t('ab.again')}
        </button>
      </section>
    );
  }

  if (run) {
    return (
      <AutoBattlePrep
        run={run}
        factors={factors}
        busy={busy}
        error={error}
        onBuy={(offer) => actLocal('buy', { offer }, (r) => buyOffer(r, offer))}
        onSell={(id) => actLocal('sell', { id }, (r) => sellUnit(r, id))}
        onMove={(id) => actLocal('move', { id }, (r) => moveUnit(r, id))}
        onReroll={() => act('reroll')}
        onBattle={() => act('battle')}
        onAbandon={() => act('abandon')}
      />
    );
  }

  // Sem run (não deu para começar: sem conexão, jogo desligado): o erro e tentar de novo.
  return (
    <section className="panel ab-end">
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" data-ab="start" onClick={() => act('start')} disabled={busy} aria-busy={busy}>
        {t('app.retry')}
      </button>
    </section>
  );
}
