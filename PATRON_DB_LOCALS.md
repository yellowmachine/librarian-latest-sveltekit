# 🚀 Patrón `locals.db` - RLS Automático

## El Problema Anterior

Antes tenías que escribir `withUser()` en cada endpoint:

```typescript
// ❌ Antes: Repetitivo
import { withUser } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
  const books = await withUser(locals.user.id, async (tx) => {
    return tx.select().from(schema.books);
  });

  return json({ books });
};
```

## ✅ Solución: `locals.db.query()`

Ahora el `userId` ya está capturado en `hooks.server.ts`:

```typescript
// ✅ Ahora: Más limpio
export const GET: RequestHandler = async ({ locals }) => {
  const books = await locals.db.query((tx) => {
    return tx.select().from(schema.books);
  });

  return json({ books });
};
```

## 🎯 Cómo Funciona

### En `hooks.server.ts`:

Cuando un usuario se autentica, configuramos `locals.db` con el `userId` ya capturado:

```typescript
event.locals.db = {
  query: async (callback) => {
    return withUser(result.user.id, callback);
  }
};
```

### En tus endpoints:

Solo llamas a `locals.db.query()` y el RLS se aplica automáticamente:

```typescript
const result = await locals.db.query((tx) => {
  // tx ya tiene el contexto del usuario configurado
  return tx.select().from(books);
});
```

## 📝 Ejemplos Completos

### Ejemplo 1: GET - Listar mis libros

```typescript
// src/routes/api/books/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { books } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  // RLS automático - solo verás tus libros y los compartidos
  const myBooks = await locals.db.query((tx) => {
    return tx.select().from(books);
  });

  return json({ books: myBooks });
};
```

### Ejemplo 2: POST - Crear un libro

```typescript
// src/routes/api/books/+server.ts
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = await request.json();

  const newBook = await locals.db.query(async (tx) => {
    const [book] = await tx.insert(books).values({
      ownerId: locals.user.id,
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      isOwned: true,
    }).returning();

    return book;
  });

  return json({ book: newBook }, { status: 201 });
};
```

### Ejemplo 3: Operaciones múltiples en una transacción

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { tagId, groupId } = await request.json();

  const result = await locals.db.query(async (tx) => {
    // Todo en una sola transacción con RLS

    // 1. Verificar que el tag existe y es tuyo
    const [tag] = await tx.select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    if (!tag) {
      throw new Error('Tag no encontrado');
    }

    // 2. Verificar que eres miembro del grupo
    const [membership] = await tx.select()
      .from(userGroups)
      .where(
        and(
          eq(userGroups.userId, locals.user.id),
          eq(userGroups.groupId, groupId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new Error('No eres miembro del grupo');
    }

    // 3. Compartir el tag al grupo
    const [shared] = await tx.insert(sharedTagsToGroups).values({
      tagId,
      groupId,
      sharedById: locals.user.id
    }).returning();

    return { tag, shared };
  });

  return json(result);
};
```

### Ejemplo 4: Con joins y filtros complejos

```typescript
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const groupId = url.searchParams.get('groupId');

  const sharedBooks = await locals.db.query((tx) => {
    return tx.select({
      book: books,
      owner: {
        id: users.id,
        name: users.name,
      },
      tags: sql<string[]>`array_agg(${tags.name})`,
    })
    .from(books)
    .innerJoin(bookTags, eq(books.id, bookTags.bookId))
    .innerJoin(tags, eq(bookTags.tagId, tags.id))
    .innerJoin(sharedTagsToGroups, eq(tags.id, sharedTagsToGroups.tagId))
    .innerJoin(users, eq(books.ownerId, users.id))
    .where(
      and(
        eq(sharedTagsToGroups.groupId, groupId),
        eq(books.isOwned, true),
        eq(books.availableForLoan, true)
      )
    )
    .groupBy(books.id, users.id);
  });

  return json({ books: sharedBooks });
};
```

### Ejemplo 5: Load function en +page.server.ts

```typescript
// src/routes/app/books/+page.server.ts
import type { PageServerLoad } from './$types';
import { books, bookTags, tags } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const [myBooks, myTags] = await Promise.all([
    // Obtener mis libros
    locals.db.query((tx) => {
      return tx.select().from(books);
    }),

    // Obtener mis tags
    locals.db.query((tx) => {
      return tx.select().from(tags);
    })
  ]);

  return {
    books: myBooks,
    tags: myTags
  };
};
```

## 🔒 Seguridad

### ✅ Ventajas:

1. **RLS siempre aplicado**: No puedes olvidarte de usar `withUser()`
2. **Código más limpio**: Menos boilerplate
3. **Type-safe**: TypeScript te obliga a usar `locals.db.query()`
4. **Un solo lugar**: El `userId` se configura una vez en hooks

### ⚠️ Importante:

- **Siempre verifica `locals.user`** antes de acceder a datos
- **`locals.db.query()` aplica RLS solo si hay usuario autenticado**
- **Para endpoints públicos**, `locals.db.query()` funciona sin RLS

## 🆚 Comparación

### Antes (con `withUser`):

```typescript
// Repetir withUser en cada endpoint
const books = await withUser(locals.user.id, (tx) => {
  return tx.select().from(schema.books);
});

const tags = await withUser(locals.user.id, (tx) => {
  return tx.select().from(schema.tags);
});
```

### Ahora (con `locals.db`):

```typescript
// El userId ya está capturado
const books = await locals.db.query((tx) => {
  return tx.select().from(schema.books);
});

const tags = await locals.db.query((tx) => {
  return tx.select().from(schema.tags);
});
```

## 💡 Tips

### Múltiples queries en paralelo:

```typescript
const [books, tags, groups] = await Promise.all([
  locals.db.query((tx) => tx.select().from(schema.books)),
  locals.db.query((tx) => tx.select().from(schema.tags)),
  locals.db.query((tx) => tx.select().from(schema.groups))
]);
```

### Manejo de errores:

```typescript
try {
  const result = await locals.db.query(async (tx) => {
    // Tus queries aquí
    return data;
  });
} catch (error) {
  if (error.message.includes('RLS')) {
    return json({ error: 'Permiso denegado' }, { status: 403 });
  }
  throw error;
}
```

### Endpoints públicos (sin autenticación):

```typescript
export const GET: RequestHandler = async ({ locals }) => {
  // Funciona sin usuario (sin RLS)
  const publicData = await locals.db.query((tx) => {
    return tx.select().from(publicTable);
  });

  return json({ data: publicData });
};
```

## 🎓 Cuándo NO usar `locals.db.query()`

- **Autenticación**: En `/api/auth/*` no hay usuario aún
- **Operaciones de admin sin RLS**: Usa `db` directo
- **Scripts de migración**: Usa `db` directo

Para esos casos, importa `db` directamente:

```typescript
import { db } from '$lib/server/db';

// Sin RLS
const allUsers = await db.select().from(users);
```

## 📚 Resumen

| Antes | Ahora |
|-------|-------|
| `withUser(userId, callback)` | `locals.db.query(callback)` |
| Repetir `userId` en cada endpoint | `userId` ya capturado en hooks |
| 3 líneas por query | 1 línea por query |
| Fácil olvidarse de `withUser()` | Imposible olvidarse (TypeScript) |

**Resultado:** Código más limpio, seguro y fácil de mantener. 🎉
