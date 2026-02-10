import type { Book } from '$lib/server/db/schema';

// Tipo para la fuente de la API
export type ApiSource = 'google' | 'openlibrary';

// Interfaz para el JSON de Open Library (endpoint ISBN y works)
interface OpenLibraryBook {
  publishers?: { name: string }[];
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: { key: string }[];
  subjects?: string[];
  thumbnail_url?: string;
  info_url: string;
  details: {
    key: string,
    title: string,
    publish_date?: string;
    covers?: number[];
    authors?: { name: string }[];
    works?: { key: string }[];
  } 
}

interface Details {
  description: string | { value: string }, 
  subjects: string[],
  first_publish_date: string;
}

function mapOpenLibraryBookToBook(
  data: OpenLibraryBook, 
  details: Details | null, 
  isbn: string
): Omit<Book, 'id' | 'userId'> {

  const description = typeof details?.description === 'string' ? details.description : details?.description?.value || "";

  console.log(data);
  console.log(details);

  return {
    bookId: data.details.key.split('/').pop() || '', // Ej: "OL27448W"
    provider: 'openlibrary',
    title: data.details.title || '',
    authors: data.details.authors?.map(author => author.name) || [],
    isbn,
    infoUrl: data.info_url,
    publishDate: data.details.publish_date || null,
    coverUrl: data.details.covers ? `https://covers.openlibrary.org/b/id/${data.details.covers[0]}-L.jpg` : '',
    firstPublishDate: details?.first_publish_date || null,
    genres: details?.subjects || null,
    description
  };
}

// Función principal queryByISBN
export async function queryByISBN(
  code: string,
  source: ApiSource = 'openlibrary',
  fetchFn: typeof fetch = fetch
): Promise<Omit<Book, 'id' | 'userId'> | null> {
  try {
    if (source === 'google') {
      throw new Error('La implementación de Google Books API está en desarrollo'); 
    } else if (source === 'openlibrary') {
      // Consulta a Open Library (endpoint ISBN)
      const apiUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=details`;
      const res = await fetchFn(apiUrl);
      const data: { [key: string]: OpenLibraryBook } = await res.json();

      const bookData = data[`ISBN:${code}`];
      if (!bookData) {
        return null;
      }

      if (bookData.details.works && bookData.details.works.length > 0) {
        const workKey = bookData.details.works[0].key;
        const worksUrl = `https://openlibrary.org${workKey}.json`;
        const worksRes = await fetchFn(worksUrl);
        const worksData: Details = await worksRes.json();
        return mapOpenLibraryBookToBook(bookData, worksData, code); 
      }

      return mapOpenLibraryBookToBook({ ...bookData}, null, code);
    }

    return null;
  } catch (error) {
    console.error(`Error querying ISBN ${code} with ${source}:`, error);
    return null;
  }
}
