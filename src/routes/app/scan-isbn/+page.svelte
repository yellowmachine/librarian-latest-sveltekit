<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  let scannedISBN = $state<string>('');
  let scanHistory = $state<string[]>([]);
  let showScanner = $state(true);
  let errorMessage = $state<string>('');

  function handleDetected(isbn: string) {
    console.log('ISBN detectado:', isbn);
    scannedISBN = isbn;

    // Agregar al historial si no está duplicado
    if (!scanHistory.includes(isbn)) {
      scanHistory = [isbn, ...scanHistory];
    }

    // Aquí podrías hacer una llamada a OpenLibrary API
    searchBookByISBN(isbn);
  }

  function handleError(error: string) {
    console.error('Error del scanner:', error);
    errorMessage = error;
  }

  async function searchBookByISBN(isbn: string) {
    try {
      // Ejemplo de búsqueda en OpenLibrary
      // Puedes adaptar esto a tu endpoint API
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();

      console.log('Datos del libro:', data);

      // Aquí procesarías los datos y mostrarías la información del libro
      // O redirigirías a un formulario prellenado
    } catch (err) {
      console.error('Error buscando libro:', err);
    }
  }

  function toggleScanner() {
    showScanner = !showScanner;
    errorMessage = '';
  }

  function clearHistory() {
    scanHistory = [];
    scannedISBN = '';
  }
</script>

<div class="page-container">
  <div class="header">
    <h1>Escanear ISBN</h1>
    <p class="subtitle">Escanea el código de barras de tus libros</p>
  </div>

  <div class="controls">
    <button onclick={toggleScanner} class="btn btn-primary">
      {showScanner ? '⏸️ Pausar Scanner' : '▶️ Activar Scanner'}
    </button>

    {#if scanHistory.length > 0}
      <button onclick={clearHistory} class="btn btn-secondary">
        🗑️ Limpiar historial
      </button>
    {/if}
  </div>

  {#if showScanner}
    <div class="scanner-wrapper">
      <ISBNScanner onDetected={handleDetected} onError={handleError} />
    </div>
  {/if}

  {#if scannedISBN}
    <div class="result-card">
      <h2>✅ Último código escaneado</h2>
      <div class="isbn-display">
        <span class="label">ISBN:</span>
        <span class="value">{scannedISBN}</span>
      </div>
      <button
        onclick={() => navigator.clipboard.writeText(scannedISBN)}
        class="btn btn-small"
      >
        📋 Copiar
      </button>
    </div>
  {/if}

  {#if scanHistory.length > 0}
    <div class="history-section">
      <h3>📚 Historial de escaneos</h3>
      <ul class="history-list">
        {#each scanHistory as isbn}
          <li class="history-item">
            <span class="isbn-code">{isbn}</span>
            <div class="item-actions">
              <button
                onclick={() => searchBookByISBN(isbn)}
                class="btn-icon"
                title="Buscar en OpenLibrary"
              >
                🔍
              </button>
              <button
                onclick={() => navigator.clipboard.writeText(isbn)}
                class="btn-icon"
                title="Copiar"
              >
                📋
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="info-section">
    <h3>ℹ️ Información</h3>
    <ul class="info-list">
      <li>Los códigos ISBN suelen estar en la parte trasera del libro</li>
      <li>Asegúrate de tener buena iluminación</li>
      <li>Mantén el código dentro del marco de escaneo</li>
      <li>El scanner detecta automáticamente códigos EAN-13 (ISBN-13)</li>
    </ul>
  </div>
</div>

<style>
  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .header {
    text-align: center;
    margin-bottom: 32px;
  }

  .header h1 {
    font-size: 32px;
    font-weight: bold;
    color: #1f2937;
    margin: 0 0 8px 0;
  }

  .subtitle {
    font-size: 16px;
    color: #6b7280;
    margin: 0;
  }

  .controls {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: #ef4444;
    color: white;
  }

  .btn-secondary:hover {
    background: #dc2626;
  }

  .btn-small {
    padding: 8px 16px;
    font-size: 13px;
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    transition: transform 0.2s;
  }

  .btn-icon:hover {
    transform: scale(1.2);
  }

  .scanner-wrapper {
    margin-bottom: 32px;
  }

  .result-card {
    background: #f0fdf4;
    border: 2px solid #86efac;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    text-align: center;
  }

  .result-card h2 {
    font-size: 20px;
    color: #166534;
    margin: 0 0 16px 0;
  }

  .isbn-display {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    font-size: 18px;
  }

  .isbn-display .label {
    font-weight: 600;
    color: #166534;
  }

  .isbn-display .value {
    font-family: 'Courier New', monospace;
    background: white;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #86efac;
  }

  .history-section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;
  }

  .history-section h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 16px 0;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .isbn-code {
    font-family: 'Courier New', monospace;
    font-size: 16px;
    color: #374151;
  }

  .item-actions {
    display: flex;
    gap: 8px;
  }

  .info-section {
    background: #eff6ff;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #bfdbfe;
  }

  .info-section h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1e40af;
    margin: 0 0 12px 0;
  }

  .info-list {
    margin: 0;
    padding-left: 20px;
    color: #1e40af;
  }

  .info-list li {
    margin-bottom: 8px;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .page-container {
      padding: 12px;
    }

    .header h1 {
      font-size: 24px;
    }

    .controls {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>
