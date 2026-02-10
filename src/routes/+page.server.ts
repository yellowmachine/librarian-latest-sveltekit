import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Si el usuario está autenticado, redirigir al dashboard
  if (locals.user) {
    throw redirect(303, '/app');
  }

  // Si no, redirigir al login
  throw redirect(303, '/login');
};
