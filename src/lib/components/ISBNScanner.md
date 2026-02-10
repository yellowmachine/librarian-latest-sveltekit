# 📷 ISBNScanner Component

Componente Svelte 5 para escanear códigos ISBN usando la cámara del dispositivo con Quagga2.

## 🚀 Instalación

Ya está instalado en el proyecto:
```bash
bun add @ericblade/quagga2  # ✅ Ya instalado
```

## 📖 Uso Básico

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  function handleDetected(isbn: string) {
    console.log('ISBN detectado:', isbn);
    // Hacer algo con el ISBN
  }

  function handleError(error: string) {
    console.error('Error:', error);
  }
</script>

<ISBNScanner
  onDetected={handleDetected}
  onError={handleError}
/>
```

## ⚙️ Props

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `onDetected` | `(isbn: string) => void` | ✅ Sí | - | Callback cuando se detecta un código |
| `onError` | `(error: string) => void` | ❌ No | `() => {}` | Callback cuando hay un error |
| `width` | `number` | ❌ No | `640` | Ancho mínimo del video |
| `height` | `number` | ❌ No | `480` | Alto mínimo del video |

## 🎯 Métodos Expuestos

El componente expone métodos públicos que puedes llamar usando `bind:this`:

```svelte
<script>
  let scanner: ISBNScanner;

  function restartScanner() {
    scanner?.restart();
  }

  function stopScanner() {
    scanner?.stop();
  }
</script>

<ISBNScanner bind:this={scanner} onDetected={handleDetected} />

<button onclick={restartScanner}>Reiniciar</button>
<button onclick={stopScanner}>Detener</button>
```

### Métodos:

- **`restart()`** - Reinicia el scanner (útil si hay errores)
- **`stop()`** - Detiene completamente el scanner

## 💡 Ejemplos de Uso

### 1. Formulario de Alta de Libro

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';
  import { goto } from '$app/navigation';

  let showScanner = $state(false);
  let isbn = $state('');

  function handleDetected(detectedISBN: string) {
    isbn = detectedISBN;
    showScanner = false;

    // Buscar datos del libro en OpenLibrary
    searchBook(detectedISBN);
  }

  async function searchBook(isbn: string) {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await response.json();
    const bookData = data[`ISBN:${isbn}`];

    if (bookData) {
      // Prellenar formulario con datos del libro
      title = bookData.title;
      author = bookData.authors?.[0]?.name || '';
      // ... más campos
    }
  }
</script>

<form>
  <div class="field">
    <label for="isbn">ISBN</label>
    <div class="input-group">
      <input type="text" id="isbn" bind:value={isbn} />
      <button type="button" onclick={() => showScanner = !showScanner}>
        📷 Escanear
      </button>
    </div>
  </div>

  {#if showScanner}
    <ISBNScanner onDetected={handleDetected} />
  {/if}

  <!-- Resto del formulario -->
</form>
```

### 2. Modal de Escaneo

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  let showModal = $state(false);
  let scannedISBN = $state('');

  function handleDetected(isbn: string) {
    scannedISBN = isbn;
    showModal = false; // Cerrar modal automáticamente
  }
</script>

<button onclick={() => showModal = true}>
  Escanear ISBN
</button>

{#if showModal}
  <div class="modal">
    <div class="modal-content">
      <button class="close" onclick={() => showModal = false}>✕</button>
      <h2>Escanea el código de barras</h2>
      <ISBNScanner onDetected={handleDetected} />
    </div>
  </div>
{/if}

{#if scannedISBN}
  <p>ISBN escaneado: {scannedISBN}</p>
{/if}
```

### 3. Con Validación y Confirmación

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  let detectedISBN = $state<string | null>(null);
  let confirmedISBN = $state<string | null>(null);

  function handleDetected(isbn: string) {
    // Validar que sea un ISBN válido (13 o 10 dígitos)
    if (isbn.length === 13 || isbn.length === 10) {
      detectedISBN = isbn;
    }
  }

  function confirmISBN() {
    confirmedISBN = detectedISBN;
    detectedISBN = null;
    // Continuar con el flujo...
  }

  function scanAgain() {
    detectedISBN = null;
  }
</script>

<ISBNScanner onDetected={handleDetected} />

{#if detectedISBN}
  <div class="confirmation">
    <p>¿Es correcto este ISBN?</p>
    <p class="isbn-large">{detectedISBN}</p>
    <button onclick={confirmISBN}>✅ Sí, es correcto</button>
    <button onclick={scanAgain}>🔄 Escanear de nuevo</button>
  </div>
{/if}
```

### 4. Escaneo Múltiple (Lista de Libros)

```svelte
<script lang="ts">
  import ISBNScanner from '$lib/components/ISBNScanner.svelte';

  let scannedBooks = $state<string[]>([]);

  function handleDetected(isbn: string) {
    // Evitar duplicados
    if (!scannedBooks.includes(isbn)) {
      scannedBooks = [...scannedBooks, isbn];

      // Vibración de confirmación
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    }
  }

  function removeBook(isbn: string) {
    scannedBooks = scannedBooks.filter(b => b !== isbn);
  }

  async function saveAllBooks() {
    // Guardar todos los libros escaneados
    for (const isbn of scannedBooks) {
      await saveBook(isbn);
    }
  }
</script>

<ISBNScanner onDetected={handleDetected} />

<div class="book-list">
  <h3>Libros escaneados ({scannedBooks.length})</h3>
  {#each scannedBooks as isbn}
    <div class="book-item">
      <span>{isbn}</span>
      <button onclick={() => removeBook(isbn)}>🗑️</button>
    </div>
  {/each}
</div>

{#if scannedBooks.length > 0}
  <button onclick={saveAllBooks}>
    Guardar todos ({scannedBooks.length} libros)
  </button>
{/if}
```

## 🎨 Personalización de Estilos

El componente usa clases CSS que puedes sobrescribir:

```svelte
<ISBNScanner onDetected={handleDetected} />

<style>
  /* Cambiar el tamaño del scanner */
  :global(.isbn-scanner) {
    max-width: 500px;
  }

  /* Personalizar el mensaje de error */
  :global(.isbn-scanner .error-message) {
    background: #your-color;
  }

  /* Cambiar el estilo de la línea de escaneo */
  :global(.isbn-scanner .scan-line) {
    background: linear-gradient(90deg, transparent, red, transparent);
  }
</style>
```

## 🔧 Configuración Avanzada

Si necesitas modificar la configuración de Quagga2, edita el archivo del componente:

```typescript
// En ISBNScanner.svelte, línea ~20
const quaggaConfig = {
  decoder: {
    readers: [
      'ean_reader',     // ISBN-13 (EAN-13)
      'ean_8_reader',   // EAN-8
      // Puedes agregar más:
      // 'code_128_reader',
      // 'code_39_reader',
    ]
  },
  frequency: 10, // Cambiar frecuencia de escaneo (1-60)
  // ...
};
```

## 📱 Permisos de Cámara

El componente solicita automáticamente permisos de cámara. Asegúrate de que tu aplicación se ejecute en:

- **HTTPS** en producción (requerido por navegadores)
- **localhost** en desarrollo (permitido)

### Mensajes de Error Comunes:

- **"Permiso de cámara denegado"** - El usuario rechazó el permiso
- **"No se encontró ninguna cámara"** - El dispositivo no tiene cámara
- **"Error al inicializar"** - Problema de configuración o compatibilidad

## 🌐 Integración con OpenLibrary

Ejemplo completo de búsqueda en OpenLibrary:

```typescript
async function searchBookByISBN(isbn: string) {
  try {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      return {
        title: book.title,
        authors: book.authors?.map(a => a.name) || [],
        publishDate: book.publish_date,
        publishers: book.publishers?.map(p => p.name) || [],
        cover: book.cover?.large || book.cover?.medium,
        url: book.url,
        // ... más campos
      };
    }
  } catch (error) {
    console.error('Error buscando libro:', error);
  }
  return null;
}
```

## 🐛 Debugging

Para ver logs detallados de Quagga2, abre la consola del navegador. El componente ya incluye logs para:

- Inicialización del scanner
- Códigos detectados con nivel de confianza
- Errores de permisos o hardware

## ⚡ Optimización

Para mejor rendimiento:

1. **Ajusta la frecuencia**: `frequency: 5` en lugar de `10` para dispositivos lentos
2. **Reduce el área de escaneo**: Más pequeña = más rápido
3. **Usa `singleChannel: true`**: Procesa en blanco y negro (más rápido)

## 📄 Página de Ejemplo

Visita `/app/scan-isbn` para ver el componente en acción con todas las funcionalidades.

## ✅ Checklist de Integración

- [ ] Importar el componente
- [ ] Definir callback `onDetected`
- [ ] (Opcional) Definir callback `onError`
- [ ] Probar en dispositivo con cámara
- [ ] Verificar permisos de cámara
- [ ] Integrar con búsqueda de libros
- [ ] Manejar casos de error
