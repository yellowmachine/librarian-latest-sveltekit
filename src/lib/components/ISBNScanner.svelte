<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Quagga from '@ericblade/quagga2';

  interface Props {
    onDetected: (isbn: string) => void;
    onError?: (error: string) => void;
    width?: number;
    height?: number;
  }

  let {
    onDetected,
    onError = () => {},
    width = 640,
    height = 480
  }: Props = $props();

  let scannerContainer = $state<HTMLDivElement>();
  let isScanning = $state(false);
  let error = $state<string>('');
  let lastScanned = $state<string>('');
  let scanCount = $state(0);

  // Configuración de Quagga2 para escanear ISBNs
  const quaggaConfig = {
    inputStream: {
      name: 'Live',
      type: 'LiveStream',
      target: null as any, // Se asignará el elemento DOM
      constraints: {
        width: { min: width },
        height: { min: height },
        facingMode: 'environment', // Cámara trasera en móviles
        aspectRatio: { min: 1, max: 2 }
      },
      area: {
        // Área de escaneo (40% del centro)
        top: '30%',
        right: '10%',
        left: '10%',
        bottom: '30%'
      },
      singleChannel: false
    },
    locator: {
      patchSize: 'medium',
      halfSample: true
    },
    decoder: {
      readers: [
        'ean_reader', // EAN-13 (ISBN-13)
        'ean_8_reader' // EAN-8 (por si acaso)
      ],
      debug: {
        drawBoundingBox: true,
        showFrequency: false,
        drawScanline: true,
        showPattern: false
      }
    },
    locate: true,
    frequency: 10 // Intentos de escaneo por segundo
  };

  function startScanner() {
    if (!scannerContainer) {
      error = 'Elemento del scanner no encontrado';
      onError(error);
      return;
    }

    // Asignar el contenedor al config
    quaggaConfig.inputStream.target = scannerContainer;

    Quagga.init(quaggaConfig, (err) => {
      if (err) {
        console.error('Error inicializando Quagga:', err);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          error = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          error = 'No se encontró ninguna cámara en el dispositivo.';
        } else {
          error = `Error al inicializar el scanner: ${err.message || err}`;
        }

        onError(error);
        return;
      }

      console.log('Quagga inicializado correctamente');
      isScanning = true;
      error = '';
      Quagga.start();
    });

    // Callback cuando se detecta un código
    Quagga.onDetected((result) => {
      if (result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        const confidence = result.codeResult.quality || 0;

        console.log('Código detectado:', code, 'Confianza:', confidence);

        // Solo aceptar códigos con buena confianza y longitud correcta
        // ISBN-13 = 13 dígitos, ISBN-10 = 10 dígitos (pero escaneamos EAN-13)
        if (confidence > 70 && (code.length === 13 || code.length === 10)) {
          // Evitar escaneos duplicados consecutivos
          if (code !== lastScanned) {
            lastScanned = code;
            scanCount++;
            onDetected(code);

            // Vibración si está disponible
            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }
          }
        }
      }
    });

    // Callback de procesamiento (opcional, para debugging)
    Quagga.onProcessed((result) => {
      const drawingCtx = Quagga.canvas.ctx.overlay;
      const drawingCanvas = Quagga.canvas.dom.overlay;

      if (result) {
        // Dibujar cajas de detección
        if (result.boxes) {
          drawingCtx.clearRect(
            0,
            0,
            parseInt(drawingCanvas.getAttribute('width') || '0'),
            parseInt(drawingCanvas.getAttribute('height') || '0')
          );

          result.boxes
            .filter((box) => box !== result.box)
            .forEach((box) => {
              Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, {
                color: 'green',
                lineWidth: 2
              });
            });
        }

        // Dibujar la caja del código detectado
        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
            color: '#00F',
            lineWidth: 2
          });
        }

        // Dibujar la línea del código
        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, {
            color: 'red',
            lineWidth: 3
          });
        }
      }
    });
  }

  function stopScanner() {
    if (isScanning) {
      Quagga.stop();
      isScanning = false;
      console.log('Scanner detenido');
    }
  }

  onMount(() => {
    // Iniciar el scanner cuando el componente se monta
    startScanner();
  });

  onDestroy(() => {
    // Limpiar cuando el componente se desmonta
    stopScanner();
    Quagga.offDetected();
    Quagga.offProcessed();
  });

  // Función pública para reiniciar el scanner
  export function restart() {
    stopScanner();
    setTimeout(() => startScanner(), 100);
  }

  // Función pública para detener
  export function stop() {
    stopScanner();
  }
</script>

<div class="isbn-scanner">
  {#if error}
    <div class="error-message">
      <svg
        class="icon-error"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p>{error}</p>
    </div>
  {/if}

  <div class="scanner-container" bind:this={scannerContainer}>
    {#if !isScanning && !error}
      <div class="loading">
        <div class="spinner"></div>
        <p>Iniciando cámara...</p>
      </div>
    {/if}
  </div>

  {#if isScanning}
    <div class="scanner-info">
      <div class="scan-line"></div>
      <p class="instruction">Coloca el código de barras dentro del marco</p>
      {#if scanCount > 0}
        <p class="scan-count">Códigos escaneados: {scanCount}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .isbn-scanner {
    position: relative;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .scanner-container {
    position: relative;
    width: 100%;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    min-height: 480px;
  }

  .scanner-container :global(video),
  .scanner-container :global(canvas) {
    width: 100%;
    height: auto;
    display: block;
  }

  .scanner-container :global(canvas.drawingBuffer) {
    position: absolute;
    top: 0;
    left: 0;
  }

  .error-message {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #c00;
  }

  .icon-error {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .error-message p {
    margin: 0;
    font-size: 14px;
  }

  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
  }

  .spinner {
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 12px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .scanner-info {
    margin-top: 16px;
    text-align: center;
  }

  .scan-line {
    height: 2px;
    background: linear-gradient(90deg, transparent, #00f, transparent);
    animation: scan 2s ease-in-out infinite;
    margin-bottom: 12px;
  }

  @keyframes scan {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
  }

  .instruction {
    font-size: 14px;
    color: #666;
    margin: 8px 0;
  }

  .scan-count {
    font-size: 12px;
    color: #999;
    margin: 4px 0 0;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .scanner-container {
      border-radius: 0;
      min-height: 360px;
    }
  }
</style>
