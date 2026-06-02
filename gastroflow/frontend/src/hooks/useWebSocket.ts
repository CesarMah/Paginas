import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useOrderStore } from '../stores/useOrderStore';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = import.meta.env.VITE_WS_URL as string;
const MAX_BACKOFF = 30000;

export function useWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useAuthStore((s) => s.token);
  const { addOrder, updateOrder } = useOrderStore();

  function connect() {
    if (!token) return;
    setConnectionStatus('connecting');

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload: unknown };
        if (msg.type === 'NEW_ORDER') addOrder(msg.payload as Parameters<typeof addOrder>[0]);
        if (msg.type === 'UPDATE_ORDER') updateOrder(msg.payload as Parameters<typeof updateOrder>[0]);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), MAX_BACKOFF);
      retryRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  useEffect(() => {
    if (token) {
      connect();
    } else {
      wsRef.current?.close();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return { connectionStatus };
}
