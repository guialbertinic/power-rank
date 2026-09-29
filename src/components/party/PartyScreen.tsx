import { useMemo, useState } from 'react';
import type { CharacterInfo } from '../../game/types';
import { usePartyRoom } from '../../party/usePartyRoom';
import PartyLobby from './PartyLobby';
import PartyPlay from './PartyPlay';
import PartyPodium from './PartyPodium';
import PartyWaiting from './PartyWaiting';

interface Props {
  code: string;
  pid: string;
  nick: string;
  token: string | null;
  charactersById: Map<string, CharacterInfo>;
  onExit: () => void;
}

/** Party (multiplayer): conecta na sala e mostra lobby → partida → espera → pódio conforme o estado da sala. */
export default function PartyScreen({ code, pid, nick, token, charactersById, onExit }: Props) {
  const { state, you, status, fatalError, notice, send, leave } = usePartyRoom(code, pid, nick, token);
  // Ao completar o ranking, já mostra a espera sem aguardar a confirmação da sala.
  const [finishedRound, setFinishedRound] = useState(0);

  const drawn = useMemo(
    () => (state?.characterIds ?? []).map((id) => charactersById.get(id)).filter((c): c is CharacterInfo => Boolean(c)),
    [state?.characterIds, charactersById],
  );

  const exit = () => {
    leave();
    onExit();
  };

  if (fatalError) {
    return (
      <section className="party">
        <div className="panel party-message">
          <p className="party-waiting-title">{fatalError}</p>
          <button className="btn btn-primary" onClick={onExit}>
            Voltar
          </button>
        </div>
      </section>
    );
  }

  if (!state || !you) {
    return (
      <section className="party">
        <div className="panel party-message">
          <p className="party-waiting-title">Entrando na sala {code}...</p>
          <span className="party-spinner" aria-hidden="true" />
        </div>
      </section>
    );
  }

  const me = state.players.find((p) => p.id === you);
  const iFinished = Boolean(me?.finished) || finishedRound === state.round;

  let screen;
  if (state.phase === 'lobby') {
    screen = <PartyLobby state={state} you={you} onStart={() => send({ type: 'start' })} onLeave={exit} />;
  } else if (state.phase === 'playing' && !iFinished) {
    screen = (
      <PartyPlay
        key={state.round}
        drawn={drawn}
        onProgress={(placed) => send({ type: 'progress', placed })}
        onFinish={(placements) => {
          setFinishedRound(state.round);
          send({ type: 'finish', placements });
        }}
      />
    );
  } else if (state.phase === 'playing') {
    screen = <PartyWaiting state={state} you={you} onEnd={() => send({ type: 'end' })} onLeave={exit} />;
  } else {
    screen = (
      <PartyPodium
        state={state}
        you={you}
        charactersById={charactersById}
        onRestart={() => send({ type: 'start' })}
        onLeave={exit}
      />
    );
  }

  return (
    <>
      {status === 'reconnecting' && <p className="party-banner">Reconectando...</p>}
      {notice && <p className="party-banner party-banner-notice">{notice}</p>}
      {screen}
    </>
  );
}
