import { Client, Connection } from '@temporalio/client';
import { env } from '../core/config/env';

// Memoize the Promise itself so concurrent callers share one connection attempt
let clientPromise: Promise<Client> | null = null;

export function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient();
  }
  return clientPromise;
}

async function createClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: env.getTemporalAddress(),
  });

  return new Client({
    connection,
    namespace: env.getTemporalNamespace(),
  });
}
