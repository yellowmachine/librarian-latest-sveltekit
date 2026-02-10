import { redirect, type Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
// import { paraglideMiddleware } from '$lib/paraglide/server'; // Descomentar cuando uses i18n
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Handle de autenticación
 * Valida la sesión del usuario en cada request
 */
const authenticationHandle: Handle = async ({ event, resolve }) => {
  // Obtener el token de sesión de las cookies
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    const result = await validateSession(sessionToken);

    if (result) {
      // Sesión válida, agregar usuario a locals
      event.locals.user = result.user;
    } else {
      // Sesión inválida o expirada, eliminar cookie
      event.cookies.delete('session', { path: '/' });
    }
  }

  return resolve(event);
};

/**
 * Handle de autorización
 * Protege rutas que requieren autenticación
 */
const authorizationHandle: Handle = async ({ event, resolve }) => {
  // Proteger rutas bajo /app (dashboard, books, etc)
  if (event.url.pathname.startsWith('/app')) {
    if (!event.locals.user) {
      throw redirect(303, '/login');
    }
  }

  // Redirigir a /app si ya está autenticado y visita login/register
  if (event.url.pathname === '/login' || event.url.pathname === '/register') {
    if (event.locals.user) {
      throw redirect(303, '/app');
    }
  }

  return resolve(event);
};

// Descomentar cuando uses paraglide (i18n)
// const handleParaglide: Handle = ({ event, resolve }) =>
//   paraglideMiddleware(event.request, ({ request, locale }) => {
//     event.request = request;
//     return resolve(event, {
//       transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
//     });
//   });

// Aplicar middleware en secuencia
export const handle: Handle = sequence(
  authenticationHandle,
  authorizationHandle
  // handleParaglide // Descomentar cuando uses i18n
);
