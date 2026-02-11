import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchBooks } from '$lib/services/externalBook';

/**
 * GET /api/books/search?q=foundation&limit=10&offset=0&language=eng
 * Búsqueda general de libros por texto
 */
export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const language = url.searchParams.get('language') || undefined;

  if (!query || query.trim().length === 0) {
    return json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  // Validar y parsear parámetros
  const limit = limitParam ? parseInt(limitParam) : 10;
  const offset = offsetParam ? parseInt(offsetParam) : 0;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return json(
      { error: 'Invalid limit. Must be between 1 and 100' },
      { status: 400 }
    );
  }

  if (isNaN(offset) || offset < 0) {
    return json(
      { error: 'Invalid offset. Must be >= 0' },
      { status: 400 }
    );
  }

  try {
    const results = await searchBooks(query, {
      limit,
      offset,
      language
    });

    return json({
      ...results,
      query,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1
    });
  } catch (error) {
    console.error('Error searching books:', error);

    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
};
