# 🚀 Remote Functions - Guía Completa

Remote Functions es una característica experimental de SvelteKit que permite llamar funciones del servidor directamente desde el cliente, con type-safety completo y sin necesidad de escribir endpoints HTTP manualmente.

## ✅ Ya Configurado

Tu proyecto ya tiene remote functions habilitadas en `svelte.config.js`:

```javascript
experimental: {
  remoteFunctions: true
}
```

## 🆚 Remote Functions vs Endpoints Tradicionales

### Endpoints Tradicionales (+server.ts)

**Antes:** Necesitas escribir endpoint y cliente por separado

```typescript
// ❌ src/routes/api/books/search-isbn/+server.ts
export const GET: RequestHandler = async ({ url }) => {
  const isbn = url.searchParams.get('isbn');
  const book = await searchByISBN(isbn);
  return json({ book });
};

// ❌ En el cliente
const response = await fetch(`/api/books/search-isbn?isbn=${isbn}`);
const { book } = await response.json();
```

### Remote Functions (.remote.ts)

**Ahora:** Una sola función, callable desde el cliente

```typescript
// ✅ src/lib/remote/books.remote.ts
import { query } from '$app/server';

export const searchBooksByISBN = query(async (isbn: string) => {
  return await searchByISBN(isbn);
});

// ✅ En el cliente (type-safe, sin fetch manual)
const book = await searchBooksByISBN(isbn);
```

## 📋 Ventajas

| Característica | Endpoints | Remote Functions |
|----------------|-----------|------------------|
| **Type-safety** | ❌ Manual | ✅ Automático |
| **Código duplicado** | ❌ Cliente + servidor | ✅ Una función |
| **Validación de tipos** | ❌ En runtime | ✅ En compile time |
| **Autocomplete** | ❌ No | ✅ Completo |
| **Manejo de errores** | ❌ Manual parsing | ✅ Try/catch nativo |
| **Serialización** | ❌ Manual JSON | ✅ Automática |
| **Testing** | ❌ Dos lugares | ✅ Una función |

## 🔑 query() vs action()

SvelteKit proporciona dos wrappers para remote functions:

### `query()` - Para lecturas (GET-like)

```typescript
import { query } from '$app/server';

// ✅ Usar para operaciones de lectura
export const getBooks = query(async () => {
  return await db.select().from(books);
});
```

- **Idempotente**: No modifica datos
- **Cacheable**: Puede usar caché del navegador
- **Seguro**: Puede repetirse sin efectos secundarios

### `action()` - Para escrituras (POST/PUT/DELETE-like)

```typescript
import { action } from '$app/server';

// ✅ Usar para operaciones de escritura
export const createBook = action(async (bookData) => {
  return await db.insert(books).values(bookData);
});
```

- **No idempotente**: Modifica datos
- **No cacheable**: Siempre se ejecuta
- **Con efectos**: Cambia el estado del servidor

**En nuestro caso:** Usamos solo `query()` porque son búsquedas (read-only).

## 📖 Cómo Usar

### 1. Crear archivo .remote.ts

```typescript
// src/lib/remote/books.remote.ts
import { query } from '$app/server';
import { searchByISBN } from '$lib/services/externalBook';
import type { ExternalBook } from '$lib/services/externalBook';

/**
 * Busca un libro por ISBN
 * Se ejecuta en el servidor, callable desde el cliente
 */
export const searchBooksByISBN = query(async (
  isbn: string
): Promise<ExternalBook | null> => {
  if (!isbn || typeof isbn !== 'string') {
    throw new Error('ISBN is required');
  }

  return await searchByISBN(isbn.trim());
});
```

**⚠️ Importante:** Las funciones deben ser wrapeadas con `query()` de `$app/server`.

### 2. Usar desde el cliente

```svelte
<script lang="ts">
  import { searchBooksByISBN } from '$lib/remote/books.remote';
  import type { ExternalBook } from '$lib/services/externalBook';

  let isbn = $state('');
  let book = $state<ExternalBook | null>(null);
  let loading = $state(false);

  async function search() {
    loading = true;
    try {
      // Llamada directa - se ejecuta en el servidor
      book = await searchBooksByISBN(isbn);
    } catch (error) {
      console.error(error.message);
    } finally {
      loading = false;
    }
  }
</script>

<input bind:value={isbn} />
<button onclick={search} disabled={loading}>
  Buscar
</button>

{#if book}
  <h2>{book.title}</h2>
  <p>{book.authors.join(', ')}</p>
{/if}
```

## 🎯 Funciones Disponibles

### `searchBooksByISBN(isbn, source?)`

Busca un libro por ISBN.

```typescript
const book = await searchBooksByISBN('9780140328721');

// Con source específico
const book = await searchBooksByISBN('9780140328721', 'openlibrary');
```

**Parámetros:**
- `isbn: string` - ISBN (10 o 13 dígitos, con o sin guiones)
- `source?: ApiSource` - API a usar (default: 'openlibrary')

**Retorna:** `ExternalBook | null`

**Throws:** `Error` si el ISBN es inválido

---

### `searchBooksByQuery(params)`

Búsqueda general de libros.

```typescript
const results = await searchBooksByQuery({
  query: 'foundation asimov',
  limit: 20,
  offset: 0,
  language: 'eng'
});

console.log(results.books);      // ExternalBook[]
console.log(results.total);      // Total de resultados
console.log(results.hasMore);    // ¿Hay más páginas?
```

**Parámetros:**
```typescript
interface SearchBooksParams {
  query: string;
  limit?: number;        // Default: 10, Max: 100
  offset?: number;       // Default: 0
  language?: string;     // Ej: 'eng', 'spa'
  source?: ApiSource;    // Default: 'openlibrary'
}
```

**Retorna:** `SearchBooksResult`

---

### `searchBooksByPage(query, page, limit?)`

Búsqueda con paginación simplificada.

```typescript
// Página 1
const page1 = await searchBooksByPage('javascript', 1, 10);

// Página 2
const page2 = await searchBooksByPage('javascript', 2, 10);
```

**Parámetros:**
- `query: string` - Texto de búsqueda
- `page: number` - Número de página (empieza en 1)
- `limit?: number` - Resultados por página (default: 10)

**Retorna:** `SearchBooksResult`

---

### `smartSearch(searchTerm)`

Búsqueda inteligente que detecta automáticamente si es ISBN o texto general.

```typescript
// Si es ISBN (10 o 13 dígitos), busca por ISBN
const result = await smartSearch('9780140328721');
// Retorna: ExternalBook

// Si es texto, hace búsqueda general
const result = await smartSearch('foundation asimov');
// Retorna: SearchBooksResult

// Detectar tipo de resultado
if ('isbn' in result && result.isbn) {
  // Es un libro específico
  console.log(result.title);
} else {
  // Es una lista de resultados
  console.log(result.books);
}
```

**Parámetros:**
- `searchTerm: string` - ISBN o texto de búsqueda

**Retorna:** `ExternalBook | SearchBooksResult`

## 💡 Ejemplos Completos

### Ejemplo 1: Búsqueda simple con loading

```svelte
<script lang="ts">
  import { searchBooksByQuery } from '$lib/remote/books.remote';

  let query = $state('');
  let results = $state(null);
  let loading = $state(false);

  async function search() {
    if (!query.trim()) return;

    loading = true;
    try {
      results = await searchBooksByQuery({
        query: query.trim(),
        limit: 10
      });
    } catch (error) {
      alert(error.message);
    } finally {
      loading = false;
    }
  }
</script>

<input bind:value={query} placeholder="Buscar..." />
<button onclick={search} disabled={loading}>
  {loading ? 'Buscando...' : 'Buscar'}
</button>

{#if results}
  <p>Encontrados: {results.total} libros</p>
  {#each results.books as book}
    <div>{book.title} - {book.authors.join(', ')}</div>
  {/each}
{/if}
```

### Ejemplo 2: Con paginación

```svelte
<script lang="ts">
  import { searchBooksByPage } from '$lib/remote/books.remote';

  let query = $state('javascript');
  let currentPage = $state(1);
  let results = $state(null);

  async function loadPage(page: number) {
    results = await searchBooksByPage(query, page, 10);
    currentPage = page;
  }

  $effect(() => {
    loadPage(1);
  });
</script>

{#if results}
  <div class="results">
    {#each results.books as book}
      <div>{book.title}</div>
    {/each}
  </div>

  <div class="pagination">
    <button
      onclick={() => loadPage(currentPage - 1)}
      disabled={currentPage === 1}
    >
      ← Anterior
    </button>

    <span>Página {currentPage}</span>

    <button
      onclick={() => loadPage(currentPage + 1)}
      disabled={!results.hasMore}
    >
      Siguiente →
    </button>
  </div>
{/if}
```

### Ejemplo 3: Búsqueda inteligente

```svelte
<script lang="ts">
  import { smartSearch } from '$lib/remote/books.remote';

  let term = $state('');
  let result = $state(null);

  async function search() {
    result = await smartSearch(term);
  }
</script>

<input bind:value={term} placeholder="ISBN o texto..." />
<button onclick={search}>Buscar</button>

{#if result}
  {#if 'isbn' in result && result.isbn}
    <!-- Es un libro específico -->
    <h2>{result.title}</h2>
    <p>{result.authors.join(', ')}</p>
  {:else}
    <!-- Es una lista de resultados -->
    <p>{result.total} resultados</p>
    {#each result.books as book}
      <div>{book.title}</div>
    {/each}
  {/if}
{/if}
```

### Ejemplo 4: Con ISBNScanner

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';
  import { searchBooksByISBN } from '$lib/remote/books.remote';

  let book = $state(null);
  let showScanner = $state(false);

  async function handleISBN(isbn: string) {
    showScanner = false;
    book = await searchBooksByISBN(isbn);
  }
</script>

<button onclick={() => showScanner = !showScanner}>
  📷 Escanear ISBN
</button>

{#if showScanner}
  <ISBNScanner onDetected={handleISBN} />
{/if}

{#if book}
  <div class="book">
    <img src={book.coverUrl} alt={book.title} />
    <h2>{book.title}</h2>
    <p>{book.authors.join(', ')}</p>
    <p>{book.description}</p>
  </div>
{/if}
```

## 🔒 Seguridad

### ✅ Las remote functions son seguras

- **Se ejecutan solo en el servidor**: El código nunca llega al cliente
- **Validación de entrada**: Siempre valida parámetros
- **Type-safe**: TypeScript previene errores

### ⚠️ Mejores prácticas

```typescript
// ✅ BIEN: Validar entrada
export async function searchBooksByISBN(isbn: string) {
  if (!isbn || typeof isbn !== 'string') {
    throw new Error('ISBN is required and must be a string');
  }

  // Limpiar y validar
  const clean = isbn.trim();
  if (clean.length === 0) {
    throw new Error('ISBN cannot be empty');
  }

  return await searchByISBN(clean);
}

// ❌ MAL: Sin validación
export async function searchBooksByISBN(isbn: string) {
  return await searchByISBN(isbn); // ¡Puede fallar!
}
```

## 🆚 Cuándo Usar Cada Uno

### Usa Remote Functions cuando:

- ✅ Necesitas type-safety completo
- ✅ La lógica es simple (1-2 llamadas a servicios)
- ✅ Quieres código más limpio
- ✅ No necesitas caching HTTP complejo
- ✅ El cliente llama directamente

### Usa Endpoints (+server.ts) cuando:

- ✅ Necesitas webhooks externos
- ✅ Quieres control total de HTTP (headers, status codes)
- ✅ Necesitas SSE o streaming
- ✅ Integración con APIs de terceros que llaman tu endpoint
- ✅ Necesitas caching HTTP específico

## 📁 Estructura Recomendada

```
src/
├── lib/
│   ├── services/           # Lógica de negocio pura
│   │   └── externalBook.ts
│   ├── remote/             # Remote functions (wrappers)
│   │   └── books.remote.ts
│   └── components/
│       └── ISBNScanner.svelte
└── routes/
    ├── api/                # Endpoints tradicionales (si necesarios)
    │   └── webhooks/
    └── app/
        └── search-books/
            └── +page.svelte # Usa remote functions
```

## 🐛 Debugging

### Ver requests en Network tab

Las remote functions aparecen como POST requests a:
```
/__data.json
```

### Logs del servidor

```typescript
export async function searchBooksByISBN(isbn: string) {
  console.log('Server: Searching ISBN', isbn); // Se ve en terminal
  return await searchByISBN(isbn);
}
```

### Manejo de errores

```svelte
<script>
  try {
    const book = await searchBooksByISBN(isbn);
  } catch (error) {
    // Error del servidor llega aquí
    console.error(error.message);
    alert('Error: ' + error.message);
  }
</script>
```

## 📚 Recursos

- Ejemplo completo: `/app/search-books`
- Código fuente: `src/lib/remote/books.remote.ts`
- Documentación de servicios: `src/lib/services/README.md`
- SvelteKit Docs: https://kit.svelte.dev/docs/remote-functions (experimental)

## 🎉 Resumen

**Remote Functions simplifican tu código:**

| Antes | Después |
|-------|---------|
| 2 archivos (+server.ts + cliente) | 1 archivo (.remote.ts) |
| Manual fetch + JSON parsing | Llamada directa de función |
| Sin type-safety | Type-safety completo |
| Duplicación de tipos | Tipos compartidos |
| Testing de API + cliente | Testing de una función |

**¡Usa remote functions para un código más limpio y type-safe!** 🚀
