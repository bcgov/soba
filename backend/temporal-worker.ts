// Must be the first import — TypeScript preserves import order in CommonJS output,
// so this module loads (and runs dotenv) before any other module is required.
import './dotenv-init';
import { run } from './src/temporal/worker';

run().catch((err) => {
  console.error('Temporal worker failed to start', err);
  process.exit(1);
});
