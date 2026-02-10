import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

/**
 * Ejecuta una transacción con el contexto de usuario para RLS
 * @param userId - UUID del usuario autenticado
 * @param callback - Función que recibe la transacción y ejecuta queries
 * @returns El resultado del callback
 *
 * @example
 * const books = await withUser(userId, async (tx) => {
 *   return tx.select().from(schema.books);
 * });
 */
export async function withUser<T>(
  userId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Configurar el user_id en la sesión de PostgreSQL para RLS
    await tx.execute(sql`SET LOCAL app.user_id = ${userId}`);

    // Ejecutar el callback con la transacción configurada
    return await callback(tx as typeof db);
  });
}

/**
 * Alternativa: Ejecuta queries directamente con contexto de usuario
 * IMPORTANTE: Solo para queries de lectura. Para writes usa withUser con transacciones.
 */
export async function queryAsUser<T>(
  userId: string,
  queryFn: (db: typeof db) => Promise<T>
): Promise<T> {
  return withUser(userId, queryFn);
}
