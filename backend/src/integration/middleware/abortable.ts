/** Stop waiting at the request deadline even when a dependency cannot cancel its own work. */
export const abortable = <T>(signal: AbortSignal, operation: () => PromiseLike<T>): Promise<T> => {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return operation();
      })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
};
