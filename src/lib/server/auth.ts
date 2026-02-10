import { db } from './db';
import { users, sessions } from './db/schema';
import { eq, lt } from 'drizzle-orm';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SESSION_EXPIRY_DAYS = 30;
const SESSION_TOKEN_LENGTH = 32; // bytes (64 caracteres hex)

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hashea una contraseña usando scrypt (Node.js crypto nativo)
 * Formato: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifica una contraseña contra un hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const hashToCompare = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(hash, 'hex');
  return timingSafeEqual(hashToCompare, storedHashBuffer);
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Genera un token de sesión criptográficamente seguro
 */
function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_LENGTH).toString('hex');
}

/**
 * Crea una nueva sesión para un usuario
 * @returns Token de sesión
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
}

/**
 * Valida un token de sesión y retorna el usuario
 * @returns Usuario si la sesión es válida, null si no
 */
export async function validateSession(token: string) {
  // Buscar sesión
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, token))
    .limit(1);

  if (!session) {
    return null;
  }

  // Verificar expiración
  if (session.expiresAt < new Date()) {
    // Sesión expirada, eliminarla
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  // Obtener usuario
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    // Usuario no existe, eliminar sesión
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  return {
    session,
    user,
  };
}

/**
 * Invalida (elimina) una sesión
 */
export async function invalidateSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

/**
 * Elimina todas las sesiones expiradas (cleanup periódico)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

/**
 * Registra un nuevo usuario
 * @throws Error si el email ya existe
 */
export async function registerUser(email: string, password: string, name: string) {
  // Verificar si el usuario ya existe
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error('El email ya está registrado');
  }

  // Crear usuario
  const passwordHash = hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
    });

  // Crear sesión
  const sessionToken = await createSession(user.id);

  return {
    user,
    sessionToken,
  };
}

/**
 * Autentica un usuario con email y password
 * @returns Usuario y token de sesión si es válido, null si no
 */
export async function loginUser(email: string, password: string) {
  // Buscar usuario
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return null;
  }

  // Verificar contraseña
  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Crear sesión
  const sessionToken = await createSession(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    sessionToken,
  };
}

/**
 * Cierra sesión (invalida el token)
 */
export async function logoutUser(sessionToken: string): Promise<void> {
  await invalidateSession(sessionToken);
}
