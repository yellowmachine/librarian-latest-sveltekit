import type { db } from '$lib/server/db';

declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string;
        email: string;
        name: string;
      };
      // Helper para ejecutar queries con RLS automáticamente
      db: {
        query: <T>(callback: (tx: typeof db) => Promise<T>) => Promise<T>;
      };
    }
  }
}

export {};


