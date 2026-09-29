import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, PartyState, ServerMessage } from '../game/party';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'failed';

/** Códigos de fechamento enviados pela sala: não adianta reconectar. */
const FATAL_CLOSE_CODES = new Set([4000, 4001]);
const MAX_RETRIES = 6;

interface PartyRoom {
  state: PartyState | null;
  /** Id público deste jogador. */
  you: string | null;
  status: ConnectionStatus;
  /** Erro que encerrou a conexão (sala não encontrada, cheia...). */
  fatalError: string | null;
  /** Aviso momentâneo do servidor (ex: "Só o dono pode iniciar"). */
  notice: string | null;
  send: (message: ClientMessage) => void;
  leave: () => void;
}

/** Conecta na sala por WebSocket e reconecta sozinho se a conexão cair (ex: celular trocou de rede). */
export function usePartyRoom(code: string, pid: string, name: string, token: string | null): PartyRoom {
  const [state, setState] = useState<PartyState | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastError: string | null = null;
    leavingRef.current = false;

    const open = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const params = new URLSearchParams({ pid, name, token: token ?? '' });
      const ws = new WebSocket(`${protocol}://${window.location.host}/api/party/${code}/ws?${params}`);
      socketRef.current = ws;

      ws.onopen = () => {
        retries = 0;
        setStatus('open');
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'state') {
          setState(message.state);
          setYou(message.you);
        } else {
          lastError = message.message;
          setNotice(message.message);
        }
      };
      ws.onclose = (event) => {
        if (socketRef.current !== ws || leavingRef.current) return;
        if (FATAL_CLOSE_CODES.has(event.code)) {
          setFatalError(event.reason || lastError || 'Conexão encerrada pela sala');
          setStatus('failed');
          return;
        }
        if (retries >= MAX_RETRIES) {
          setFatalError('Não foi possível reconectar à sala');
          setStatus('failed');
          return;
        }
        setStatus('reconnecting');
        retryTimer = setTimeout(open, Math.min(1000 * 2 ** retries++, 8000));
      };
    };

    open();
    return () => {
      leavingRef.current = true;
      clearTimeout(retryTimer);
      socketRef.current?.close(1000);
      socketRef.current = null;
    };
  }, [code, pid, name, token]);

  // Avisos somem sozinhos.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const send = useCallback((message: ClientMessage) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }, []);

  const leave = useCallback(() => {
    leavingRef.current = true;
    socketRef.current?.close(1000);
  }, []);

  return { state, you, status, fatalError, notice, send, leave };
}
