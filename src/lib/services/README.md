# 📚 External Books Service

Servicio para buscar libros en APIs externas (OpenLibrary, Google Books).

## 🚀 Funcionalidades

- ✅ **Búsqueda por ISBN** (10 o 13 dígitos)
- ✅ **Búsqueda general** (por título, autor, texto libre)
- ✅ **Caché automático** (5 minutos, configurable)
- ✅ **Timeout de requests** (10 segundos)
- ✅ **Type-safe** (TypeScript completo)
- ✅ **Paginación** en búsquedas
- ✅ **Filtros** (idioma, límite)

## 📖 API

### 1. Búsqueda por ISBN

```typescript
import { searchByISBN } from '$lib/services/externalBook';

// Buscar por ISBN-13
const book = await searchByISBN('9780140328721');

// Buscar por ISBN-10
const book = await searchByISBN('0140328726');

// Con guiones (se limpian automáticamente)
const book = await searchByISBN('978-0-14-032872-1');

if (book) {
  console.log(book.title);       // "Foundation"
  console.log(book.authors);     // ["Isaac Asimov"]
  console.log(book.description); // "The first novel in..."
  console.log(book.coverUrl);    // URL de portada grande
  console.log(book.infoUrl);     // Enlace a OpenLibrary
}
```

### 2. Búsqueda General

```typescript
import { searchBooks } from '$lib/services/externalBook';

// Búsqueda simple
const result = await searchBooks('foundation asimov');

console.log(result.total);      // Total de resultados
console.log(result.hasMore);    // ¿Hay más páginas?
console.log(result.books);      // Array de ExternalBook[]

// Con opciones
const result = await searchBooks('javascript', {
  limit: 20,           // Resultados por página (default: 10)
  offset: 0,           // Offset para paginación (default: 0)
  language: 'spa',     // Filtrar por idioma (opcional)
  source: 'openlibrary' // API a usar (default: 'openlibrary')
});
```

## 📝 Tipos

### ExternalBook

```typescript
interface ExternalBook {
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
  subjects?: string[];      // Géneros/temas
  language?: string;

  // URLs y covers
  coverUrl?: string;        // Portada grande
  coverUrlSmall?: string;   // Portada pequeña (thumbnail)
  infoUrl: string;          // Enlace a la fuente

  // Metadata
  pageCount?: number;
  firstPublishDate?: string;

  // Source info
  source: 'openlibrary' | 'google';
  sourceId: string;         // ID en la fuente
}
```

### SearchResult

```typescript
interface SearchResult {
  books: ExternalBook[];
  total: number;      // Total de resultados
  hasMore: boolean;   // ¿Hay más páginas?
}
```

## 💡 Ejemplos de Uso

### Ejemplo 1: Endpoint API para escaneo ISBN

```typescript
// src/routes/api/books/search-isbn/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchByISBN } from '$lib/services/externalBook';

export const GET: RequestHandler = async ({ url }) => {
  const isbn = url.searchParams.get('isbn');

  if (!isbn) {
    return json({ error: 'ISBN required' }, { status: 400 });
  }

  try {
    const book = await searchByISBN(isbn);

    if (!book) {
      return json({ error: 'Book not found' }, { status: 404 });
    }

    return json({ book });
  } catch (error) {
    return json(
      { error: error.message },
      { status: 400 }
    );
  }
};
```

### Ejemplo 2: Formulario de alta con ISBN

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';
  import type { ExternalBook } from '$lib/services/externalBook';

  let isbn = $state('');
  let bookData = $state<ExternalBook | null>(null);
  let loading = $state(false);
  let showScanner = $state(false);

  async function searchISBN() {
    if (!isbn) return;

    loading = true;
    try {
      const response = await fetch(`/api/books/search-isbn?isbn=${isbn}`);
      const data = await response.json();

      if (response.ok) {
        bookData = data.book;
        // Prellenar formulario con datos
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error buscando libro');
    } finally {
      loading = false;
    }
  }

  function handleISBNDetected(detectedISBN: string) {
    isbn = detectedISBN;
    showScanner = false;
    searchISBN();
  }
</script>

<form>
  <div class="field">
    <label>ISBN</label>
    <div class="input-group">
      <input
        type="text"
        bind:value={isbn}
        placeholder="978-..."
      />
      <button type="button" onclick={() => showScanner = !showScanner}>
        📷 Escanear
      </button>
      <button type="button" onclick={searchISBN} disabled={loading}>
        🔍 Buscar
      </button>
    </div>
  </div>

  {#if showScanner}
    <ISBNScanner onDetected={handleISBNDetected} />
  {/if}

  {#if bookData}
    <div class="book-preview">
      <img src={bookData.coverUrl} alt={bookData.title} />
      <h3>{bookData.title}</h3>
      <p>Por: {bookData.authors.join(', ')}</p>
      <p>{bookData.description}</p>
    </div>

    <!-- Resto del formulario prellenado -->
    <input type="text" bind:value={bookData.title} />
    <input type="text" value={bookData.authors.join(', ')} />
    <!-- etc -->
  {/if}
</form>
```

### Ejemplo 3: Búsqueda general con paginación

```svelte
<script lang="ts">
  import type { SearchResult } from '$lib/services/externalBook';

  let query = $state('');
  let results = $state<SearchResult | null>(null);
  let loading = $state(false);
  let page = $state(0);
  const limit = 10;

  async function search() {
    if (!query) return;

    loading = true;
    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${page * limit}`
      );
      const data = await response.json();
      results = data;
    } catch (error) {
      alert('Error en búsqueda');
    } finally {
      loading = false;
    }
  }

  function nextPage() {
    page++;
    search();
  }

  function prevPage() {
    if (page > 0) {
      page--;
      search();
    }
  }
</script>

<div class="search">
  <input
    type="text"
    bind:value={query}
    placeholder="Buscar por título, autor..."
    onkeydown={(e) => e.key === 'Enter' && search()}
  />
  <button onclick={search} disabled={loading}>
    Buscar
  </button>
</div>

{#if results}
  <div class="results">
    <p>
      Encontrados: {results.total} resultados
      (página {page + 1})
    </p>

    {#each results.books as book}
      <div class="book-card">
        <img src={book.coverUrlSmall} alt={book.title} />
        <div class="info">
          <h3>{book.title}</h3>
          <p class="authors">{book.authors.join(', ')}</p>
          {#if book.publishDate}
            <p class="date">Publicado: {book.publishDate}</p>
          {/if}
          <a href={book.infoUrl} target="_blank">
            Ver en OpenLibrary →
          </a>
        </div>
      </div>
    {/each}

    <div class="pagination">
      <button onclick={prevPage} disabled={page === 0}>
        ← Anterior
      </button>
      <span>Página {page + 1}</span>
      <button onclick={nextPage} disabled={!results.hasMore}>
        Siguiente →
      </button>
    </div>
  </div>
{/if}
```

### Ejemplo 4: Endpoint de búsqueda general

```typescript
// src/routes/api/books/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchBooks } from '$lib/services/externalBook';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const language = url.searchParams.get('language') || undefined;

  if (!query) {
    return json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const results = await searchBooks(query, {
      limit,
      offset,
      language
    });

    return json(results);
  } catch (error) {
    return json(
      { error: error.message },
      { status: 400 }
    );
  }
};
```

### Ejemplo 5: Guardar libro desde búsqueda externa

```typescript
// src/routes/api/books/from-external/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchByISBN } from '$lib/services/externalBook';
import { books } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { isbn } = await request.json();

  // Buscar en API externa
  const externalBook = await searchByISBN(isbn);

  if (!externalBook) {
    return json({ error: 'Libro no encontrado' }, { status: 404 });
  }

  // Guardar en nuestra DB con RLS
  const newBook = await locals.db.query(async (tx) => {
    const [book] = await tx.insert(books).values({
      ownerId: locals.user.id,
      title: externalBook.title,
      author: externalBook.authors.join(', '),
      isbn: externalBook.isbn,
      description: externalBook.description,
      openLibraryUrl: externalBook.infoUrl,
      isOwned: true,
      availableForLoan: true
    }).returning();

    return book;
  });

  return json({ book: newBook }, { status: 201 });
};
```

## 🎯 Mejoras Implementadas

### vs. Código Anterior

| Antes | Ahora |
|-------|-------|
| Solo ISBN | ISBN + búsqueda general |
| Sin caché | Caché de 5 minutos |
| Sin timeout | Timeout de 10s |
| Tipos incompletos | Tipos completos y documentados |
| console.log en producción | Logging limpio |
| Mapeo manual | Funciones helper |
| Sin validación de ISBN | Validación automática |
| Sin paginación | Paginación incorporada |

### Nuevas Características

- ✅ **Búsqueda general por texto**
- ✅ **Caché inteligente** (evita requests duplicados)
- ✅ **Timeout** (no bloquea indefinidamente)
- ✅ **Limpieza de ISBN** (acepta con guiones)
- ✅ **Validación** de formato ISBN
- ✅ **Portadas** en dos tamaños (pequeña y grande)
- ✅ **Paginación** nativa
- ✅ **Filtros** (idioma, límite)
- ✅ **Better error handling**

## 🔧 Configuración

### Ajustar duración de caché:

```typescript
// En externalBook.ts, línea ~78
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
// Cambiar a: 10 * 60 * 1000 para 10 minutos
```

### Ajustar timeout de requests:

```typescript
// En fetchWithTimeout(), línea ~112
timeoutMs: number = 10000  // 10 segundos
// Cambiar a: 15000 para 15 segundos
```

## 🌐 Códigos de Idioma

Para filtrar por idioma en búsquedas:

```typescript
searchBooks('javascript', { language: 'eng' }); // Inglés
searchBooks('javascript', { language: 'spa' }); // Español
searchBooks('javascript', { language: 'fre' }); // Francés
searchBooks('javascript', { language: 'ger' }); // Alemán
```

Lista completa: https://openlibrary.org/languages.json

## 📊 Límites de API

OpenLibrary no tiene límite oficial, pero se recomienda:
- Max 1 request por segundo
- Usar caché para evitar requests duplicados
- Implementar debounce en búsquedas en tiempo real

## 🚧 Google Books API

La integración con Google Books está preparada pero no implementada. Para agregarla:

1. Obtener API key: https://console.cloud.google.com/
2. Implementar funciones análogas a OpenLibrary
3. Mapear respuesta a `ExternalBook`

## 🐛 Troubleshooting

### "Request timeout"
- La API está lenta o caída
- Aumentar el timeout en `fetchWithTimeout()`

### "Invalid ISBN format"
- El ISBN debe tener 10 o 13 dígitos
- Guiones y espacios se limpian automáticamente

### "Book not found"
- El ISBN no existe en la base de datos de OpenLibrary
- Probar con búsqueda general por título

## 📚 Recursos

- OpenLibrary API: https://openlibrary.org/developers/api
- OpenLibrary Search: https://openlibrary.org/dev/docs/api/search
- ISBN Info: https://www.isbn.org/
