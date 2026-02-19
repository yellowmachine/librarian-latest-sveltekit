<script lang="ts">
  export let book: {
    ownerId: string;
    title: string;
    author: string | null;
    isbn: string | null;
    description: string | null;
    openLibraryUrl: string | null;
    isOwned: boolean;
    availableForLoan: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

  $: coverImageUrl = book.isbn
    ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`
    : `https://via.placeholder.com/128x192?text=No+Cover`; // Placeholder if no ISBN
</script>

<div class="flex border border-gray-200 rounded-lg p-4 mb-4 bg-white shadow-md gap-4 items-start">
  <div class="book-cover flex-shrink-0 w-32 h-48 overflow-hidden rounded shadow-sm">
    <img src={coverImageUrl} alt={`Cover of ${book.title}`} class="w-full h-full object-cover" />
  </div>
  <div class="book-info flex-grow">
    <h3 class="book-title text-lg font-bold mt-0 mb-2 text-gray-800">{book.title}</h3>
    {#if book.author}
      <p class="book-author italic text-gray-600 mb-1">{book.author}</p>
    {/if}
    {#if book.isbn}
      <p class="book-isbn text-sm text-gray-500 mb-2">ISBN: {book.isbn}</p>
    {/if}
    {#if book.description}
      <p class="book-description text-sm text-gray-700 leading-relaxed">
        {book.description.length > 150 ? book.description.substring(0, 150) + '...' : book.description}
      </p>
    {/if}
  </div>
</div>
