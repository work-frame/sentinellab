'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Refetch now. Resolves once the new data or error is stored. */
  reload: () => Promise<void>;
}

interface Stored<T> {
  path: string | null;
  data?: T;
  error?: ApiError;
}

const toApiError = (err: unknown) => (err instanceof ApiError ? err : new ApiError(0, 'Unexpected error'));

/**
 * Fetch `path` on mount and whenever it changes; pass null to skip. With
 * pollMs, refetch on an interval while `shouldPoll(data)` returns true.
 * Results are stored together with the path they belong to, so a slow
 * response for an old path can never show up under a new one.
 */
export function useApi<T>(path: string | null, opts: { pollMs?: number; shouldPoll?: (data: T) => boolean } = {}): ApiState<T> {
  const [stored, setStored] = useState<Stored<T>>({ path: null });
  const { pollMs, shouldPoll } = opts;

  const reload = useCallback(async () => {
    if (path === null) return;
    try {
      const data = await api<T>(path);
      setStored({ path, data });
    } catch (err) {
      setStored((prev) => ({ path, data: prev.path === path ? prev.data : undefined, error: toApiError(err) }));
    }
  }, [path]);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    api<T>(path).then(
      (data) => !cancelled && setStored({ path, data }),
      (err) => !cancelled && setStored({ path, error: toApiError(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  const current = stored.path === path ? stored : undefined;
  const data = current?.data;

  useEffect(() => {
    if (!pollMs || data === undefined || (shouldPoll && !shouldPoll(data))) return;
    const id = setInterval(() => void reload(), pollMs);
    return () => clearInterval(id);
    // shouldPoll is usually an inline function; re-arming on data change is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, data, reload]);

  return { data, error: current?.error, loading: path !== null && current === undefined, reload };
}
