import { useCallback, useEffect, useRef, useState } from 'react';

export interface AbortableRequestState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

export interface UseAbortableRequestResult<T> extends AbortableRequestState<T> {
  /** Re-run the request, cancelling any in-flight request first. */
  retry: () => void;
}

/**
 * Runs an abortable async request and keeps its state safe across navigation.
 *
 * The request receives an AbortSignal that is aborted when the component
 * unmounts or when the request is re-run (e.g. via `retry`). Stale responses
 * are ignored so an unmounted view is never updated.
 */
export function useAbortableRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): UseAbortableRequestResult<T> {
  const [state, setState] = useState<AbortableRequestState<T>>({
    data: null,
    error: null,
    isLoading: true,
  });

  const requestRef = useRef(request);
  requestRef.current = request;

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    requestRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setState({ data, error: null, isLoading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setState({
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
          isLoading: false,
        });
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, ...deps]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}

export default useAbortableRequest;
