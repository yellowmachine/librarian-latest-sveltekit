<script lang="ts">
  /**
   * Ejemplo de uso de Remote Functions para búsqueda de libros
   *
   * Las remote functions se llaman como funciones normales pero se ejecutan en el servidor.
   * Type-safety completo y sin necesidad de fetch manual.
   */

  import {
    searchBooksByISBN,
    searchBooksByQuery,
    searchBooksByPage,
    smartSearch,
    type SearchBooksResult
  } from '$lib/remote/books.remote';
  import type { ExternalBook } from '$lib/services/externalBook';
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  // Estado
  let searchMode = $state<'isbn' | 'text'>('text');
  let searchTerm = $state('');
  let loading = $state(false);
  let error = $state('');

  // Resultados
  let singleBook = $state<ExternalBook | null>(null);
  let searchResults = $state<SearchBooksResult | null>(null);

  // Paginación
  let currentPage = $state(1);
  const resultsPerPage = 10;

  // Scanner
  let showScanner = $state(false);

  // ========================================================================
  // BÚSQUEDA POR ISBN
  // ========================================================================

  async function handleISBNSearch() {
    if (!searchTerm.trim()) {
      error = 'Por favor ingresa un ISBN';
      return;
    }

    loading = true;
    error = '';
    singleBook = null;
    searchResults = null;

    try {
      // Llamada directa a remote function (se ejecuta en el servidor)
      const book = await searchBooksByISBN(searchTerm.trim());

      if (book) {
        singleBook = book;
      } else {
        error = 'Libro no encontrado';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  // ========================================================================
  // BÚSQUEDA POR TEXTO
  // ========================================================================

  async function handleTextSearch() {
    if (!searchTerm.trim()) {
      error = 'Por favor ingresa un término de búsqueda';
      return;
    }

    loading = true;
    error = '';
    singleBook = null;
    searchResults = null;
    currentPage = 1;

    try {
      // Llamada directa a remote function
      const results = await searchBooksByQuery({
        query: searchTerm.trim(),
        limit: resultsPerPage,
        offset: 0
      });

      searchResults = results;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  // ========================================================================
  // PAGINACIÓN
  // ========================================================================

  async function goToPage(page: number) {
    if (!searchResults) return;

    loading = true;
    error = '';

    try {
      // Usar helper de paginación
      const results = await searchBooksByPage(
        searchResults.query,
        page,
        resultsPerPage
      );

      searchResults = results;
      currentPage = page;

      // Scroll al top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  // ========================================================================
  // BÚSQUEDA INTELIGENTE (ISBN o Texto)
  // ========================================================================

  async function handleSmartSearch() {
    if (!searchTerm.trim()) {
      error = 'Por favor ingresa un término de búsqueda';
      return;
    }

    loading = true;
    error = '';
    singleBook = null;
    searchResults = null;

    try {
      const result = await smartSearch(searchTerm.trim());

      // Detectar tipo de resultado
      if ('isbn' in result && result.isbn) {
        // Es un ExternalBook (búsqueda por ISBN)
        singleBook = result as ExternalBook;
      } else {
        // Es SearchBooksResult (búsqueda general)
        searchResults = result as SearchBooksResult;
        currentPage = 1;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  }

  // ========================================================================
  // SCANNER
  // ========================================================================

  async function handleISBNDetected(isbn: string) {
    searchTerm = isbn;
    showScanner = false;
    searchMode = 'isbn';
    await handleISBNSearch();
  }

  // ========================================================================
  // HANDLERS
  // ========================================================================

  function handleSubmit() {
    if (searchMode === 'isbn') {
      handleISBNSearch();
    } else {
      handleTextSearch();
    }
  }

  function clearResults() {
    singleBook = null;
    searchResults = null;
    error = '';
  }
</script>

<div class="page">
  <header class="header">
    <h1>🔍 Buscar Libros</h1>
    <p class="subtitle">Usando Remote Functions</p>
  </header>

  <!-- Selector de modo -->
  <div class="mode-selector">
    <button
      class:active={searchMode === 'text'}
      onclick={() => {
        searchMode = 'text';
        clearResults();
      }}
    >
      📚 Búsqueda General
    </button>
    <button
      class:active={searchMode === 'isbn'}
      onclick={() => {
        searchMode = 'isbn';
        clearResults();
      }}
    >
      🔢 Por ISBN
    </button>
  </div>

  <!-- Formulario de búsqueda -->
  <form class="search-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
    <div class="input-group">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder={searchMode === 'isbn' ? 'Ingresa ISBN...' : 'Buscar por título, autor...'}
        disabled={loading}
      />

      {#if searchMode === 'isbn'}
        <button
          type="button"
          class="btn-icon"
          onclick={() => showScanner = !showScanner}
          disabled={loading}
        >
          📷
        </button>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading}>
        {loading ? '⏳ Buscando...' : '🔍 Buscar'}
      </button>
    </div>

    <button
      type="button"
      class="btn-smart"
      onclick={handleSmartSearch}
      disabled={loading}
    >
      ✨ Búsqueda Inteligente (detecta ISBN automáticamente)
    </button>
  </form>

  <!-- Scanner ISBN -->
  {#if showScanner}
    <div class="scanner-section">
      <ISBNScanner onDetected={handleISBNDetected} />
    </div>
  {/if}

  <!-- Error -->
  {#if error}
    <div class="error-box">
      <span class="icon">⚠️</span>
      <p>{error}</p>
    </div>
  {/if}

  <!-- Resultado único (ISBN) -->
  {#if singleBook}
    <div class="single-result">
      <h2>✅ Libro Encontrado</h2>
      <div class="book-card large">
        {#if singleBook.coverUrl}
          <img src={singleBook.coverUrl} alt={singleBook.title} class="cover" />
        {:else}
          <div class="cover-placeholder">📖</div>
        {/if}

        <div class="info">
          <h3>{singleBook.title}</h3>
          <p class="authors">Por: {singleBook.authors.join(', ')}</p>

          {#if singleBook.publisher || singleBook.publishDate}
            <p class="metadata">
              {singleBook.publisher || ''}
              {singleBook.publishDate ? ` (${singleBook.publishDate})` : ''}
            </p>
          {/if}

          {#if singleBook.description}
            <p class="description">{singleBook.description}</p>
          {/if}

          {#if singleBook.subjects && singleBook.subjects.length > 0}
            <div class="subjects">
              {#each singleBook.subjects.slice(0, 5) as subject}
                <span class="tag">{subject}</span>
              {/each}
            </div>
          {/if}

          <div class="actions">
            <a href={singleBook.infoUrl} target="_blank" class="btn-link">
              Ver en OpenLibrary →
            </a>
            {#if singleBook.isbn}
              <span class="isbn">ISBN: {singleBook.isbn}</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Resultados múltiples (búsqueda general) -->
  {#if searchResults}
    <div class="search-results">
      <div class="results-header">
        <h2>
          📚 {searchResults.total} resultado{searchResults.total !== 1 ? 's' : ''}
        </h2>
        <p class="page-info">
          Página {currentPage} • Mostrando {searchResults.books.length} libros
        </p>
      </div>

      <div class="books-grid">
        {#each searchResults.books as book}
          <div class="book-card">
            {#if book.coverUrlSmall}
              <img src={book.coverUrlSmall} alt={book.title} class="cover-small" />
            {:else}
              <div class="cover-placeholder small">📖</div>
            {/if}

            <div class="info-compact">
              <h4>{book.title}</h4>
              <p class="authors-small">{book.authors.join(', ')}</p>
              {#if book.publishDate}
                <p class="date">{book.publishDate}</p>
              {/if}
              <a href={book.infoUrl} target="_blank" class="link-small">
                Ver más →
              </a>
            </div>
          </div>
        {/each}
      </div>

      <!-- Paginación -->
      {#if searchResults.total > resultsPerPage}
        <div class="pagination">
          <button
            onclick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            class="btn-page"
          >
            ← Anterior
          </button>

          <span class="page-numbers">
            Página {currentPage} de {Math.ceil(searchResults.total / resultsPerPage)}
          </span>

          <button
            onclick={() => goToPage(currentPage + 1)}
            disabled={!searchResults.hasMore || loading}
            class="btn-page"
          >
            Siguiente →
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }

  .header {
    text-align: center;
    margin-bottom: 32px;
  }

  .header h1 {
    font-size: 36px;
    margin: 0 0 8px 0;
  }

  .subtitle {
    color: #666;
    font-size: 14px;
  }

  .mode-selector {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 24px;
  }

  .mode-selector button {
    padding: 12px 24px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .mode-selector button.active {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #3b82f6;
  }

  .search-form {
    margin-bottom: 32px;
  }

  .input-group {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .input-group input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
  }

  .btn-icon {
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 20px;
  }

  .btn-primary {
    padding: 12px 24px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-smart {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .scanner-section {
    margin-bottom: 24px;
  }

  .error-box {
    background: #fee;
    border: 2px solid #fcc;
    padding: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    color: #c00;
  }

  .single-result {
    margin-top: 32px;
  }

  .single-result h2 {
    margin-bottom: 24px;
  }

  .book-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .book-card.large {
    display: flex;
    gap: 24px;
  }

  .cover {
    width: 200px;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .cover-placeholder {
    width: 200px;
    height: 300px;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 64px;
    border-radius: 8px;
  }

  .info h3 {
    font-size: 28px;
    margin: 0 0 8px 0;
  }

  .authors {
    color: #666;
    font-size: 18px;
    margin: 0 0 12px 0;
  }

  .metadata {
    color: #999;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .description {
    line-height: 1.6;
    margin-bottom: 16px;
  }

  .subjects {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .tag {
    background: #eff6ff;
    color: #3b82f6;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 600;
  }

  .isbn {
    color: #999;
    font-size: 14px;
  }

  .results-header {
    margin-bottom: 24px;
  }

  .results-header h2 {
    margin: 0 0 4px 0;
  }

  .page-info {
    color: #666;
    font-size: 14px;
  }

  .books-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
  }

  .cover-small {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 8px;
  }

  .cover-placeholder.small {
    width: 100%;
    height: 200px;
    font-size: 48px;
  }

  .info-compact h4 {
    font-size: 16px;
    margin: 12px 0 4px 0;
  }

  .authors-small {
    color: #666;
    font-size: 14px;
    margin: 0 0 4px 0;
  }

  .date {
    color: #999;
    font-size: 12px;
    margin: 0 0 8px 0;
  }

  .link-small {
    color: #3b82f6;
    font-size: 14px;
    text-decoration: none;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
  }

  .btn-page {
    padding: 8px 16px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    font-weight: 600;
    color: #666;
  }

  @media (max-width: 768px) {
    .book-card.large {
      flex-direction: column;
    }

    .cover,
    .cover-placeholder {
      width: 100%;
      max-width: 300px;
      margin: 0 auto;
    }

    .books-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
