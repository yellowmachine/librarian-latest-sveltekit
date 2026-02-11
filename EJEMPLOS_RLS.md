# 📚 Ejemplos de Uso con RLS

## Estructura básica de autenticación

Primero necesitas un hook que maneje la autenticación. Ejemplo en `src/hooks.server.ts`:

```typescript
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
  // TODO: Obtener el userId de tu sistema de auth (cookies, JWT, etc)
  // Por ahora, ejemplo simple:
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    // Buscar usuario por sesión (implementa tu lógica)
    const user = await db.select()
      .from(users)
      .where(eq(users.id, sessionToken)) // Simplificado
      .limit(1);

    if (user[0]) {
      event.locals.user = {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name
      };
    }
  }

  return resolve(event);
};
```

## 📖 Ejemplo 1: Listar mis libros

```typescript
// src/routes/api/books/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { books } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals }) => {
  // Verificar autenticación
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // RLS automático usando locals.db.query()
  const myBooks = await locals.db.query((tx) => {
    return tx.select().from(books);
  });

  return json({ books: myBooks });
};
```

**💡 Nota:** Ahora usamos `locals.db.query()` en lugar de `withUser()`.
El `userId` ya está capturado en `hooks.server.ts`. Ver `PATRON_DB_LOCALS.md` para más info.

## ➕ Ejemplo 2: Crear un libro

```typescript
// src/routes/api/books/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = await request.json();

  try {
    const newBook = await withUser(locals.user.id, async (tx) => {
      const [book] = await tx.insert(books).values({
        ownerId: locals.user.id,
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        description: data.description,
        openLibraryUrl: data.openLibraryUrl,
        isOwned: data.isOwned ?? true,
        availableForLoan: data.availableForLoan ?? true
      }).returning();

      return book;
    });

    return json({ book: newBook }, { status: 201 });
  } catch (error) {
    console.error('Error creando libro:', error);
    return json({ error: 'Error al crear libro' }, { status: 500 });
  }
};
```

## 🏷️ Ejemplo 3: Compartir etiqueta a grupo

```typescript
// src/routes/api/tags/[tagId]/share/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withUser } from '$lib/server/db';
import { sharedTagsToGroups, tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { groupId } = await request.json();

  try {
    const result = await withUser(locals.user.id, async (tx) => {
      // Verificar que el tag le pertenece (RLS lo valida también)
      const [tag] = await tx.select()
        .from(tags)
        .where(eq(tags.id, params.tagId))
        .limit(1);

      if (!tag) {
        throw new Error('Tag no encontrado');
      }

      // Compartir el tag al grupo
      const [shared] = await tx.insert(sharedTagsToGroups).values({
        tagId: params.tagId,
        groupId: groupId,
        sharedById: locals.user.id
      }).returning();

      return shared;
    });

    return json({ success: true, shared: result });
  } catch (error) {
    console.error('Error compartiendo tag:', error);
    return json({ error: error.message }, { status: 400 });
  }
};
```

## 📘 Ejemplo 4: Solicitar préstamo de libro

```typescript
// src/routes/api/loans/request/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withUser } from '$lib/server/db';
import { bookLoans, books } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { bookId } = await request.json();

  try {
    const loan = await withUser(locals.user.id, async (tx) => {
      // Obtener info del libro
      const [book] = await tx.select()
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);

      if (!book) {
        throw new Error('Libro no encontrado o no compartido contigo');
      }

      if (!book.isOwned || !book.availableForLoan) {
        throw new Error('Libro no disponible para préstamo');
      }

      // Crear solicitud de préstamo
      // RLS validará que:
      // - Sean contactos
      // - El libro esté compartido en grupo común
      // - Todas las condiciones de negocio
      const [newLoan] = await tx.insert(bookLoans).values({
        bookId: bookId,
        requesterId: locals.user.id,
        ownerId: book.ownerId,
        status: 'pending'
      }).returning();

      return newLoan;
    });

    return json({ loan }, { status: 201 });
  } catch (error) {
    console.error('Error solicitando préstamo:', error);
    return json({ error: error.message }, { status: 400 });
  }
};
```

## 🔄 Ejemplo 5: Aprobar/Denegar préstamo

```typescript
// src/routes/api/loans/[loanId]/respond/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withUser } from '$lib/server/db';
import { bookLoans } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { action } = await request.json(); // 'approve' o 'deny'

  try {
    const updatedLoan = await withUser(locals.user.id, async (tx) => {
      const [loan] = await tx.update(bookLoans)
        .set({
          status: action === 'approve' ? 'loaned' : 'denied',
          respondedAt: new Date(),
          loanedAt: action === 'approve' ? new Date() : null
        })
        .where(eq(bookLoans.id, params.loanId))
        .returning();

      // RLS valida que solo el owner puede hacer esto
      // y que el estado sea 'pending'

      if (!loan) {
        throw new Error('No tienes permiso o el préstamo no existe');
      }

      return loan;
    });

    return json({ loan: updatedLoan });
  } catch (error) {
    console.error('Error respondiendo préstamo:', error);
    return json({ error: error.message }, { status: 400 });
  }
};
```

## 🔍 Ejemplo 6: Buscar libros disponibles en mis grupos

```typescript
// src/routes/books/available/+page.server.ts
import type { PageServerLoad } from './$types';
import { withUser } from '$lib/server/db';
import { books, bookTags, sharedTagsToGroups, userGroups } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { availableBooks: [] };
  }

  const availableBooks = await withUser(locals.user.id, async (tx) => {
    // RLS automáticamente filtra para mostrar solo libros
    // con etiquetas compartidas en tus grupos
    return tx.select({
      book: books,
      // Puedes agregar joins si necesitas más info
    })
    .from(books)
    .where(
      and(
        eq(books.isOwned, true),
        eq(books.availableForLoan, true)
      )
    );
  });

  return {
    availableBooks
  };
};
```

## 🎯 Notas Importantes

1. **Siempre usa `withUser()`**: Es la forma correcta de ejecutar queries con RLS
2. **RLS valida en DB**: Incluso si tu código tiene bugs, RLS te protege
3. **Errores de RLS**: Si una query falla por RLS, no devolverá filas o lanzará error según la operación
4. **Transacciones**: `withUser()` ya usa transacciones internamente
5. **Testing**: Puedes mockear `locals.user` en tests para probar con diferentes usuarios
