import { Database } from '@nozbe/watermelondb';

import { error, info } from '@/utils/logger/logger';

export async function safeWrite<T>(
  database: Database,
  operation: () => Promise<T>,
  timeoutMs: number = 10000,
  operationName: string = 'unnamed'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`[DB] | Échec de l'opération d'écriture "${operationName}" : délai dépassé après ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      database.write(operation),
      timeoutPromise
    ]);
    return result;
  } catch (err) {
    error(`[DB] | Échec de l'opération d'écriture "${operationName}": ${String(err)}`);
    throw err;
  }
}

export async function safeRead<T>(
  database: Database,
  operation: () => Promise<T>,
  timeoutMs: number = 5000,
  operationName: string = 'unnamed'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`[DB] | Échec de l'opération de lecture "${operationName}" : délai dépassé après ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      database.read(operation),
      timeoutPromise
    ]);
    info(`[DB] | Opération de lecture réussie : ${operationName}`);
    return result;
  } catch (err) {
    error(`[DB] | Échec de l'opération de lecture "${operationName}": ${String(err)}`);
    throw err;
  }
}

export function batchOperations<T>(
  items: T[],
  batchSize: number = 100
): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

export async function executeBatchedOperations<T>(
  database: Database,
  batches: (() => Promise<T>)[],
  delayMs: number = 100,
  operationName: string = 'batched'
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < batches.length; i++) {
    info(`[DB] | Exécution du lot ${i + 1}/${batches.length} pour ${operationName}`);

    try {
      const result = await safeWrite(
        database,
        batches[i],
        15000,
        `${operationName}_batch_${i + 1}`
      );
      results.push(result);

      if (i < batches.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      error(`[DB] | Échec du lot ${i + 1} pour ${operationName}: ${String(err)}`);
      throw err;
    }
  }

  return results;
}