<script lang="ts">
	import { page } from '$app/stores'; // Changed from $app/state to $app/stores
	import type { LayoutData } from './$types'; // Import LayoutData type
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Access session data from layout.server.ts
	let { data }: { data: LayoutData } = $props();

	// Reactive variable to check if user is logged in
	$: isLoggedIn = !!data.session?.user;
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="bg-gray-800 text-white p-4 shadow-md">
  <nav class="container mx-auto flex justify-between items-center">
    <a href="/" class="text-xl font-bold">Librarian</a>
    <ul class="flex space-x-4">
      {#if isLoggedIn}
        <li><a href="/app/books" class="hover:text-gray-300">Mi Biblioteca</a></li>
        <li><a href="/app/books/new" class="hover:text-gray-300">Dar de alta un libro</a></li>
        <li><a href="/app/groups/search" class="hover:text-gray-300">Búsqueda en Grupos</a></li>
        <li>
          <form action="/logout" method="POST">
            <button type="submit" class="hover:text-gray-300 focus:outline-none">Logout</button>
          </form>
        </li>
      {:else}
        <li><a href="/login" class="hover:text-gray-300">Login</a></li>
        <li><a href="/register" class="hover:text-gray-300">Register</a></li> <!-- Added register link -->
      {/if}
    </ul>
  </nav>
</header>

<main class="container mx-auto p-4">
  {@render children()}
</main>

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>
			{locale}
		</a>
	{/each}
</div>

