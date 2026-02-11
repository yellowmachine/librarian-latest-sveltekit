/**
 * Servicio para buscar libros en APIs externas (OpenLibrary, Google Books)
 * Soporta búsqueda por ISBN y búsqueda general por texto
 */

// ============================================================================
// TIPOS
// ============================================================================

export type ApiSource = 'openlibrary' | 'google';

/**
 * Estructura de datos de libro externo (unificada)
 */
export interface ExternalBook {
  // Identificadores
  isbn?: string;
  isbn10?: string;
  isbn13?: string;

  // Información básica
  title: string;
  authors: string[];
  publisher?: string;
  publishDate?: string;

  // Descripción y categorización
  description?: string;
  subjects?: string[];
  language?: string;

  // URLs y covers
  coverUrl?: string;
  coverUrlSmall?: string;
  infoUrl: string;

  // Metadata
  pageCount?: number;
  firstPublishDate?: string;

  // Source info
  source: ApiSource;
  sourceId: string; // ID en la fuente (ej: "OL27448W")
}

/**
 * Resultado de búsqueda (lista)
 */
export interface SearchResult {
  books: ExternalBook[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// TIPOS DE OPENLIBRARY API
// ============================================================================

interface OpenLibraryISBNResponse {
  [key: string]: {
    publishers?: { name: string }[];
    isbn_10?: string[];
    isbn_13?: string[];
    languages?: { key: string }[];
    thumbnail_url?: string;
    info_url: string;
    details: {
      key: string;
      title: string;
      subtitle?: string;
      publish_date?: string;
      covers?: number[];
      authors?: { key: string; name?: string }[];
      works?: { key: string }[];
      publishers?: string[];
      number_of_pages?: number;
    };
  };
}

interface OpenLibraryWork {
  description?: string | { value: string; type: string };
  subjects?: string[];
  first_publish_date?: string;
  covers?: number[];
  title?: string;
}

interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: Array<{
    key: string;
    title: string;
    subtitle?: string;
    author_name?: string[];
    first_publish_year?: number;
    isbn?: string[];
    publisher?: string[];
    cover_i?: number;
    subject?: string[];
    language?: string[];
    number_of_pages_median?: number;
  }>;
}

// ============================================================================
// CACHÉ SIMPLE (5 minutos)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Cleanup periódico (cada 10 minutos)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Fetch con timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Extraer descripción de OpenLibrary (puede ser string o objeto)
 */
function extractDescription(desc: string | { value: string } | undefined): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  return desc.value || '';
}

/**
 * Construir URL de cover de OpenLibrary
 */
function getCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'L'): string {
  if (!coverId) return '';
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

// ============================================================================
// OPENLIBRARY: BÚSQUEDA POR ISBN
// ============================================================================

async function searchOpenLibraryByISBN(isbn: string): Promise<ExternalBook | null> {
  const cacheKey = `ol-isbn-${isbn}`;
  const cached = getCached<ExternalBook>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=details`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }

    const data: OpenLibraryISBNResponse = await response.json();
    const bookData = data[`ISBN:${isbn}`];

    if (!bookData) {
      return null;
    }

    // Intentar obtener detalles adicionales del "work"
    let workDetails: OpenLibraryWork | null = null;
    if (bookData.details.works?.[0]) {
      try {
        const workKey = bookData.details.works[0].key;
        const workUrl = `https://openlibrary.org${workKey}.json`;
        const workResponse = await fetchWithTimeout(workUrl);
        workDetails = await workResponse.json();
      } catch (error) {
        console.warn('Could not fetch work details:', error);
      }
    }

    // Mapear a ExternalBook
    const book: ExternalBook = {
      isbn,
      isbn10: bookData.isbn_10?.[0],
      isbn13: bookData.isbn_13?.[0],
      title: bookData.details.title,
      authors: bookData.details.authors?.map(a => a.name || 'Unknown') || [],
      publisher: bookData.details.publishers?.[0] || bookData.publishers?.[0]?.name,
      publishDate: bookData.details.publish_date,
      description: extractDescription(workDetails?.description),
      subjects: workDetails?.subjects || [],
      language: bookData.languages?.[0]?.key.replace('/languages/', ''),
      coverUrl: getCoverUrl(bookData.details.covers?.[0] || workDetails?.covers?.[0], 'L'),
      coverUrlSmall: getCoverUrl(bookData.details.covers?.[0] || workDetails?.covers?.[0], 'S'),
      infoUrl: bookData.info_url,
      pageCount: bookData.details.number_of_pages,
      firstPublishDate: workDetails?.first_publish_date,
      source: 'openlibrary',
      sourceId: bookData.details.key.split('/').pop() || ''
    };

    setCache(cacheKey, book);
    return book;
  } catch (error) {
    console.error(`Error searching ISBN ${isbn} in OpenLibrary:`, error);
    return null;
  }
}

// ============================================================================
// OPENLIBRARY: BÚSQUEDA GENERAL
// ============================================================================

async function searchOpenLibrary(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}
): Promise<SearchResult> {
  const { limit = 10, offset = 0, language } = options;

  const cacheKey = `ol-search-${query}-${limit}-${offset}-${language || 'all'}`;
  const cached = getCached<SearchResult>(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: offset.toString(),
      fields: 'key,title,subtitle,author_name,first_publish_year,isbn,publisher,cover_i,subject,language,number_of_pages_median'
    });

    if (language) {
      params.append('language', language);
    }

    const url = `https://openlibrary.org/search.json?${params}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`OpenLibrary Search API error: ${response.status}`);
    }

    const data: OpenLibrarySearchResponse = await response.json();

    const books: ExternalBook[] = data.docs.map(doc => ({
      isbn: doc.isbn?.[0],
      isbn13: doc.isbn?.find(i => i.length === 13),
      isbn10: doc.isbn?.find(i => i.length === 10),
      title: doc.title,
      authors: doc.author_name || [],
      publisher: doc.publisher?.[0],
      publishDate: doc.first_publish_year?.toString(),
      subjects: doc.subject?.slice(0, 10) || [],
      language: doc.language?.[0],
      coverUrl: getCoverUrl(doc.cover_i, 'L'),
      coverUrlSmall: getCoverUrl(doc.cover_i, 'S'),
      infoUrl: `https://openlibrary.org${doc.key}`,
      pageCount: doc.number_of_pages_median,
      firstPublishDate: doc.first_publish_year?.toString(),
      source: 'openlibrary',
      sourceId: doc.key.split('/').pop() || ''
    }));

    const result: SearchResult = {
      books,
      total: data.numFound,
      hasMore: data.numFound > offset + limit
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error(`Error searching "${query}" in OpenLibrary:`, error);
    return { books: [], total: 0, hasMore: false };
  }
}

// ============================================================================
// API PÚBLICA
// ============================================================================

/**
 * Buscar libro por ISBN
 * @param isbn Código ISBN (10 o 13 dígitos)
 * @param source API a usar (por defecto: openlibrary)
 * @returns ExternalBook o null si no se encuentra
 */
export async function searchByISBN(
  isbn: string,
  source: ApiSource = 'openlibrary'
): Promise<ExternalBook | null> {
  // Limpiar ISBN (eliminar guiones y espacios)
  const cleanISBN = isbn.replace(/[-\s]/g, '');

  // Validar formato
  if (!/^\d{10}(\d{3})?$/.test(cleanISBN)) {
    throw new Error('Invalid ISBN format. Must be 10 or 13 digits.');
  }

  if (source === 'openlibrary') {
    return searchOpenLibraryByISBN(cleanISBN);
  } else if (source === 'google') {
    throw new Error('Google Books API not implemented yet');
  }

  throw new Error(`Unknown source: ${source}`);
}

/**
 * Búsqueda general de libros por texto
 * @param query Texto de búsqueda (título, autor, etc.)
 * @param options Opciones de búsqueda
 * @returns SearchResult con lista de libros
 */
export async function searchBooks(
  query: string,
  options: {
    source?: ApiSource;
    limit?: number;
    offset?: number;
    language?: string;
  } = {}
): Promise<SearchResult> {
  const { source = 'openlibrary', ...searchOptions } = options;

  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  if (source === 'openlibrary') {
    return searchOpenLibrary(query.trim(), searchOptions);
  } else if (source === 'google') {
    throw new Error('Google Books API not implemented yet');
  }

  throw new Error(`Unknown source: ${source}`);
}
