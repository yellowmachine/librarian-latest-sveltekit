/**
 * Remote Functions para búsqueda de libros externos
 *
 * Estas funciones se ejecutan en el servidor pero pueden ser llamadas
 * directamente desde el cliente con type-safety completo.
 *
 * Uso desde el cliente:
 * import { searchBooksByISBN, searchBooksByQuery } from '$lib/remote/books.remote';
 *
 * const book = await searchBooksByISBN('9780140328721');
 * const results = await searchBooksByQuery({ query: 'foundation' });
 */

import { query } from '$app/server';
import { searchByISBN, searchBooks } from '$lib/services/externalBook';
import type { ExternalBook, SearchResult, ApiSource } from '$lib/services/externalBook';

// ============================================================================
// BÚSQUEDA POR ISBN
// ============================================================================

/**
 * Busca un libro por ISBN en OpenLibrary
 * @param isbn Código ISBN (10 o 13 dígitos, con o sin guiones)
 * @param source API a usar (default: 'openlibrary')
 * @returns ExternalBook o null si no se encuentra
 * @throws Error si el ISBN es inválido
 */
export const searchBooksByISBN = query(async (
  isbn: string,
  source: ApiSource = 'openlibrary'
): Promise<ExternalBook | null> => {
  // Validación de entrada
  if (!isbn || typeof isbn !== 'string') {
    throw new Error('ISBN is required and must be a string');
  }

  const cleanISBN = isbn.trim();
  if (cleanISBN.length === 0) {
    throw new Error('ISBN cannot be empty');
  }

  try {
    return await searchByISBN(cleanISBN, source);
  } catch (error) {
    // Re-lanzar con mensaje más específico
    if (error instanceof Error) {
      throw new Error(`ISBN search failed: ${error.message}`);
    }
    throw new Error('ISBN search failed: Unknown error');
  }
});

// ============================================================================
// BÚSQUEDA GENERAL
// ============================================================================

/**
 * Parámetros de búsqueda general
 */
export interface SearchBooksParams {
  query: string;
  limit?: number;
  offset?: number;
  language?: string;
  source?: ApiSource;
}

/**
 * Resultado de búsqueda con metadata adicional
 */
export interface SearchBooksResult extends SearchResult {
  query: string;
  limit: number;
  offset: number;
  page: number;
}

/**
 * Búsqueda general de libros por texto
 * @param params Parámetros de búsqueda
 * @returns SearchBooksResult con lista de libros y metadata
 * @throws Error si la query es inválida
 */
export const searchBooksByQuery = query(async (
  params: SearchBooksParams
): Promise<SearchBooksResult> => {
  const { query: searchQuery, limit = 10, offset = 0, language, source = 'openlibrary' } = params;

  // Validación de entrada
  if (!searchQuery || typeof searchQuery !== 'string') {
    throw new Error('Query is required and must be a string');
  }

  const cleanQuery = searchQuery.trim();
  if (cleanQuery.length === 0) {
    throw new Error('Query cannot be empty');
  }

  // Validar límite
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  // Validar offset
  if (offset < 0) {
    throw new Error('Offset must be >= 0');
  }

  try {
    const results = await searchBooks(cleanQuery, {
      limit,
      offset,
      language,
      source
    });

    // Agregar metadata de la búsqueda
    return {
      ...results,
      query: cleanQuery,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Search failed: ${error.message}`);
    }
    throw new Error('Search failed: Unknown error');
  }
});

// ============================================================================
// BÚSQUEDA CON PAGINACIÓN SIMPLIFICADA
// ============================================================================

/**
 * Búsqueda con número de página en lugar de offset
 * @param searchQuery Texto de búsqueda
 * @param page Número de página (empieza en 1)
 * @param limit Resultados por página (default: 10)
 * @returns SearchBooksResult
 */
export const searchBooksByPage = query(async (
  searchQuery: string,
  page: number = 1,
  limit: number = 10
): Promise<SearchBooksResult> => {
  if (page < 1) {
    throw new Error('Page must be >= 1');
  }

  const offset = (page - 1) * limit;

  return searchBooksByQuery({
    query: searchQuery,
    limit,
    offset
  });
});

// ============================================================================
// BÚSQUEDA COMBINADA (ISBN o Texto)
// ============================================================================

/**
 * Búsqueda inteligente: detecta si es ISBN o texto general
 * @param searchTerm Término de búsqueda (ISBN o texto)
 * @returns ExternalBook si es ISBN, SearchBooksResult si es texto general
 */
export const smartSearch = query(async (
  searchTerm: string
): Promise<ExternalBook | SearchBooksResult> => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    throw new Error('Search term is required');
  }

  const cleanTerm = searchTerm.trim().replace(/[-\s]/g, '');

  // Detectar si parece un ISBN (10 o 13 dígitos)
  const isISBN = /^\d{10}(\d{3})?$/.test(cleanTerm);

  if (isISBN) {
    // Buscar por ISBN
    const book = await searchBooksByISBN(cleanTerm);
    if (book) {
      return book;
    }
    // Si no se encuentra por ISBN, hacer búsqueda general
  }

  // Búsqueda general
  return searchBooksByQuery({
    query: searchTerm.trim(),
    limit: 10,
    offset: 0
  });
});
