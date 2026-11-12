import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  isRealtimeConnected,
  subscribeRealtime,
  subscribeStatus,
  type RealtimeEvent,
} from "./realtime";

type Handlers = {
  onEvent?: (event: RealtimeEvent) => void;
  // Соединение вернулось после заметного перерыва: события могли пропасть, нужен полный refetch
  onCatchUp?: () => void;
};

const CATCH_UP_AFTER_MS = 3000;

export function useRealtime(userId: string | null | undefined, handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  const connected = useSyncExternalStore(subscribeStatus, isRealtimeConnected, () => false);

  useEffect(() => {
    if (!userId) return;

    // Быстрое первое подключение (до 3 с) не требует догоняющего запроса: данные только что загружены
    let downSince: number | null = isRealtimeConnected() ? null : Date.now();
    const offStatus = subscribeStatus((up) => {
      if (!up) {
        downSince ??= Date.now();
        return;
      }
      if (downSince !== null && Date.now() - downSince > CATCH_UP_AFTER_MS) {
        ref.current.onCatchUp?.();
      }
      downSince = null;
    });
    const offEvents = subscribeRealtime(userId, (e) => ref.current.onEvent?.(e));

    return () => {
      offStatus();
      offEvents();
    };
  }, [userId]);

  return { connected };
}