# Configuración de Row Level Security (RLS)

## 📋 Pasos para habilitar RLS

Después de ejecutar las migraciones de Drizzle, necesitas ejecutar estos comandos SQL manualmente en tu base de datos para habilitar RLS:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_tags_to_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_loans ENABLE ROW LEVEL SECURITY;

-- Forzar RLS incluso para el owner de la tabla (recomendado para desarrollo)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;
ALTER TABLE user_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE books FORCE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE book_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_tags_to_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE book_loans FORCE ROW LEVEL SECURITY;
```

## 🔧 Configuración de Docker Compose

Tu `docker-compose.yml` debería incluir el usuario de la base de datos. Ejemplo:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: librarian
      POSTGRES_PASSWORD: librarian_dev_password
      POSTGRES_DB: librarian
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🌐 Variables de Entorno

En tu `.env`:

```env
DATABASE_URL=postgresql://librarian:librarian_dev_password@localhost:5432/librarian
```

## 🧪 Testing RLS

Para probar que RLS funciona correctamente:

```sql
-- Como superuser, inserta un usuario de prueba
INSERT INTO users (id, email, name)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'test@example.com', 'Test User');

-- Configura el contexto del usuario
SET LOCAL app.user_id = '123e4567-e89b-12d3-a456-426614174000';

-- Ahora solo deberías ver tus propios datos
SELECT * FROM users; -- Debería mostrar todos (policy permite select all)
SELECT * FROM books; -- Solo tus libros
```

## 📝 Notas Importantes

1. **Desarrollo local**: RLS está habilitado y funcional
2. **Producción (Neon)**: Las políticas son las mismas, Neon soporta RLS nativo
3. **Las políticas están definidas en `schema.ts`**: Drizzle las genera automáticamente en las migraciones
4. **`app.user_id` debe configurarse en cada request**: Usa `withUser()` helper (ver ejemplos abajo)

## 💡 Uso en la Aplicación

### En endpoints de SvelteKit:

```typescript
// src/routes/api/books/+server.ts
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export async function GET({ locals }) {
  const userId = locals.user.id; // De tu sistema de auth

  const myBooks = await withUser(userId, async (tx) => {
    return tx.select().from(books);
  });

  return json(myBooks);
}
```

### En load functions:

```typescript
// src/routes/books/+page.server.ts
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export async function load({ locals }) {
  const userId = locals.user.id;

  const myBooks = await withUser(userId, async (tx) => {
    return tx.select().from(books);
  });

  return { books: myBooks };
}
```

### Para operaciones write:

```typescript
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export async function POST({ request, locals }) {
  const userId = locals.user.id;
  const data = await request.json();

  const newBook = await withUser(userId, async (tx) => {
    return tx.insert(books).values({
      ownerId: userId,
      title: data.title,
      author: data.author,
      // ...
    }).returning();
  });

  return json(newBook);
}
```

## ⚠️ Seguridad

- **NUNCA ejecutes queries sin `withUser()`** en código que maneje datos de usuarios
- **SIEMPRE obtén el userId de `locals.user`** (autenticación verificada server-side)
- **Las políticas RLS son tu última línea de defensa**: Incluso si olvidas filtrar en el código, RLS te protege
