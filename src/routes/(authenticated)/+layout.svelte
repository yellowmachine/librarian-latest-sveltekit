<svelte:boundary>
	{#snippet failed(error, reset)}
		<div class="error-container">
			<h1>😱 Algo salió mal</h1>
			<p>{error.message}</p>
			<button onclick={reset}>Reintentar</button>
			<a href="/">Volver al inicio</a>
		</div>
	{/snippet}

	<div class="app-layout">
		<nav>
			<!-- Tu navegación -->
		</nav>
		<main>
			<slot />
		</main>
	</div>
</svelte:boundary>
