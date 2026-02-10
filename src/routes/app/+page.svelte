<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST'
      });

      goto('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 justify-between">
        <div class="flex">
          <div class="flex flex-shrink-0 items-center">
            <h1 class="text-xl font-bold text-gray-900">Librarian</h1>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-700">
            {data.user.name}
          </span>
          <button
            onclick={handleLogout}
            class="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  </nav>

  <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="rounded-lg bg-white px-5 py-6 shadow sm:px-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">
        ¡Bienvenido, {data.user.name}!
      </h2>
      <p class="text-gray-600 mb-4">
        Email: {data.user.email}
      </p>
      <p class="text-gray-600">
        Este es tu dashboard. Aquí irán tus libros, grupos, préstamos, etc.
      </p>
    </div>
  </main>
</div>
