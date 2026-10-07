/**
 * Runs `step` on each item one at a time, in order, and returns the results in item order. For
 * writes whose order matters (creation order, ids recorded as they are made, form engine calls) and
 * for work that must not take every pooled connection at once.
 */
export const inSequence = <T, R>(
  items: readonly T[],
  step: (item: T, index: number) => Promise<R>,
): Promise<R[]> =>
  items.reduce<Promise<R[]>>(
    (previous, item, index) =>
      previous.then((results) =>
        step(item, index).then((result) => {
          results.push(result);
          return results;
        }),
      ),
    Promise.resolve([]),
  );
