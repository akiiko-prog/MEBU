import { Database } from "@nozbe/watermelondb";

import { error, info, warn } from "@/utils/logger/logger";

import { getDatabaseInstance } from "../DatabaseProvider";

export class DatabaseInitializer {
  private static instance: DatabaseInitializer;
  private isInitialized = false;

  static getInstance(): DatabaseInitializer {
    if (!DatabaseInitializer.instance) {
      DatabaseInitializer.instance = new DatabaseInitializer();
    }
    return DatabaseInitializer.instance;
  }

  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const db = getDatabaseInstance();

      await this.forceResetDatabaseQueue(db);

      const isResponsive = await this.testInitialDatabaseHealth(db);

      if (!isResponsive) {
        warn("Database appears to be unresponsive, attempting recovery...");
        await this.attemptDatabaseRecovery(db);
      }

      this.isInitialized = true;
      info("[DB] | Initialisation de la base de données terminée avec succès");

    } catch (err) {
      error(`[DB] | Échec de l'initialisation de la base de données : ${err}`);
      throw err;
    }
  }

  private async forceResetDatabaseQueue(db: Database): Promise<void> {
    try {
      info("[DB] | Réinitialisation forcée de la file d'attente de la base de données...");

      for (let i = 0; i < 3; i++) {
        const resetPromise = db.write(async () => {
          // Empty write operation to flush the queue
        });

        await Promise.race([
          resetPromise,
          new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Queue reset ${i + 1} timeout`));
            }, 3000);
          })
        ]);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      info("[DB] | Réinitialisation de la file d'attente de la base de données terminée");

    } catch (err) {
      warn(`[DB] | Échec de la réinitialisation de la file d'attente de la base de données : ${err}`);
      warn("[DB] | La base de données peut démarrer avec des performances dégradées");
    }
  }

  private async testInitialDatabaseHealth(db: Database): Promise<boolean> {
    try {
      const startTime = Date.now();

      const testPromise = db.collections.get('news').query().fetch();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Database health check timeout"));
        }, 5000);
      });

      await Promise.race([testPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      info(`[DB] | Vérification de l'intégrité de la base de données terminée avec succès (${duration}ms)`);

      return duration < 3000;

    } catch (err) {
      error(`[DB] | Échec de la vérification de l'intégrité de la base de données : ${err}`);
      return false;
    }
  }

  private async attemptDatabaseRecovery(db: Database): Promise<void> {
    try {
      info("[DB] | Tentative de récupération de la base de données...");

      const recoveryPromise = db.write(async () => {
        const collections = ['news', 'homework', 'grades', 'subjects'];
        for (const collectionName of collections) {
          try {
            await db.collections.get(collectionName).query().fetch();
          } catch (err) {
            warn(`Failed to read from ${collectionName}: ${err}`);
          }
        }
      });

      await Promise.race([
        recoveryPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Recovery timeout"));
          }, 10000);
        })
      ]);

      info("[DB] | Récupération de la base de données terminée");

    } catch (err) {
      error(`[DB] | Échec de la récupération de la base de données : ${err}`);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export async function initializeDatabaseOnStartup(): Promise<void> {
  const initializer = DatabaseInitializer.getInstance();
  await initializer.initializeDatabase();
}