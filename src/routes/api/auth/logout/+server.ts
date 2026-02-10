import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logoutUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
  const sessionToken = cookies.get('session');

  if (sessionToken) {
    // Invalidar sesión en la DB
    await logoutUser(sessionToken);
  }

  // Eliminar cookie
  cookies.delete('session', { path: '/' });

  return json({ success: true });
};
