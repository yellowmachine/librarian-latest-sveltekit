import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchByISBN } from '$lib/services/externalBook';

/**
 * GET /api/books/search-isbn?isbn=978...
 * Busca un libro por ISBN en OpenLibrary
 */
export const GET: RequestHandler = async ({ url }) => {
  const isbn = url.searchParams.get('isbn');

  if (!isbn) {
    return json(
      { error: 'ISBN parameter is required' },
      { status: 400 }
    );
  }

  try {
    const book = await searchByISBN(isbn);

    if (!book) {
      return json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    return json({ book });
  } catch (error) {
    console.error('Error searching ISBN:', error);

    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
};
