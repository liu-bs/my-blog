"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface MutationCallbacks<TData> {
  onSuccess?: (data: TData) => void;

  onError?: (err: Error) => void;

  onSettled?: () => void;
}

interface AsyncAction<TVars, TData> {
  mutate: (vars: TVars, callbacks?: MutationCallbacks<TData>) => Promise<TData | undefined>;

  isPending: boolean;
}

export function useAsyncAction<TVars, TData>(
  action: (vars: TVars) => Promise<TData>,
  defaults?: MutationCallbacks<TData>,
): AsyncAction<TVars, TData> {
  const [isPending, setIsPending] = useState(false);

  const mutatingRef = useRef(false);

  const defaultsRef = useRef(defaults);

  useEffect(() => {
    defaultsRef.current = defaults;
  });

  const mutate = useCallback(
    async (vars: TVars, callbacks?: MutationCallbacks<TData>) => {
      if (mutatingRef.current) return undefined;
      mutatingRef.current = true;
      setIsPending(true);

      try {
        const data = await action(vars);

        (callbacks?.onSuccess ?? defaultsRef.current?.onSuccess)?.(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        (callbacks?.onError ?? defaultsRef.current?.onError)?.(error);
        return undefined;
      } finally {
        mutatingRef.current = false;
        setIsPending(false);
        (callbacks?.onSettled ?? defaultsRef.current?.onSettled)?.();
      }
    },
    [action],
  );

  return { mutate, isPending };
}
