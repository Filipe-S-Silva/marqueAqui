import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export interface AsyncState<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }

/** Carrega dados e ignora respostas de requisições antigas (evita corrida entre filtros). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (id === run.current) setData(d); })
      .catch((e: unknown) => { if (id === run.current) setError(e instanceof ApiError ? e.message : 'Falha ao carregar os dados.'); })
      .finally(() => { if (id === run.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429 && e.retryAfter) return `${e.message} Tente novamente em ${e.retryAfter}s.`;
    return e.message;
  }
  return 'Não foi possível concluir a operação.';
}
