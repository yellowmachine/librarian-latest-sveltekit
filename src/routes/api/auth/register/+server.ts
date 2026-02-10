import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registerUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password, name } = await request.json();

    // Validación básica
    if (!email || !password || !name) {
      return json(
        { error: 'Email, password y nombre son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Registrar usuario
    const { user, sessionToken } = await registerUser(email, password, name);

    // Configurar cookie de sesión
    cookies.set('session', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    return json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error en registro:', error);

    if (error instanceof Error) {
      if (error.message.includes('ya está registrado')) {
        return json({ error: error.message }, { status: 409 });
      }
    }

    return json(
      { error: 'Error al registrar usuario' },
      { status: 500 }
    );
  }
};
