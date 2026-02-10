import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loginUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    // Validación básica
    if (!email || !password) {
      return json(
        { error: 'Email y password son requeridos' },
        { status: 400 }
      );
    }

    // Intentar login
    const result = await loginUser(email, password);

    if (!result) {
      return json(
        { error: 'Email o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Configurar cookie de sesión
    cookies.set('session', result.sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return json({ user: result.user });
  } catch (error) {
    console.error('Error en login:', error);
    return json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    );
  }
};
