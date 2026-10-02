// Renders in progress in this process.
let inFlight = 0;

/** Run `render` in one of `max` render slots this process shares; 'busy' when every slot is taken. */
export async function withRenderSlot<T>(
  max: number,
  render: () => Promise<T>,
): Promise<T | 'busy'> {
  if (inFlight >= max) return 'busy';
  inFlight += 1;
  try {
    return await render();
  } finally {
    inFlight -= 1;
  }
}
