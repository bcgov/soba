// Must be the first import — TypeScript preserves import order in CommonJS output,
// so this module loads (and runs dotenv) before any other module is required.
import './dotenv-init';
import { log } from './src/core/logging';
import { run } from './src/temporal/worker';

run().catch((err: unknown) => {
  log.child({ component: 'temporal-worker' }).error({ err }, 'Temporal worker failed to start');
  process.exit(1);
});
