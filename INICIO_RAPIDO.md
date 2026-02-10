# 🚀 Inicio Rápido - Sistema de Autenticación con RLS

## ✅ Todo Está Configurado

Ya tienes un sistema completo de autenticación con RLS funcionando:

- ✅ Email/Password con hashing seguro (scrypt)
- ✅ Sesiones con cookies HTTP-only
- ✅ Row Level Security (RLS) configurado
- ✅ Páginas de Login y Register
- ✅ Dashboard protegido
- ✅ Hooks de autenticación automáticos

## 📦 Pasos para Ejecutar

### 1. Instalar dependencias (si no lo has hecho)

```bash
bun install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz:

```env
DATABASE_URL=postgresql://librarian:librarian_dev_password@localhost:5432/librarian
NODE_ENV=development
```

### 3. Levantar la base de datos

```bash
bun db:start
# O si usas podman directamente:
# podman compose up -d
```

### 4. Generar y aplicar migraciones

```bash
# Generar migraciones desde el schema
bun db:generate

# Aplicar migraciones
bun db:migrate
```

### 5. Habilitar RLS en las tablas

```bash
# Si usas docker
docker exec -i <container_name> psql -U librarian -d librarian < src/lib/server/db/enable-rls.sql

# Si usas podman
podman exec -i <container_name> psql -U librarian -d librarian < src/lib/server/db/enable-rls.sql

# O conectarte directamente
psql -U librarian -d librarian -f src/lib/server/db/enable-rls.sql
```

### 6. Iniciar la aplicación

```bash
bun dev
```

### 7. Probar el sistema

1. Visita `http://localhost:5173`
2. Serás redirigido a `/login`
3. Haz clic en "crea una cuenta nueva"
4. Regístrate con email, nombre y contraseña
5. Serás redirigido automáticamente a `/app` (dashboard)

## 🔐 Estructura de Autenticación

### Archivos creados:

```
src/
├── lib/
│   └── server/
│       ├── auth.ts              # Lógica de autenticación
│       └── db/
│           ├── schema.ts        # Schema con RLS
│           ├── index.ts         # Helper withUser()
│           └── enable-rls.sql   # Script para habilitar RLS
├── routes/
│   ├── +page.server.ts          # Redirect a login o app
│   ├── login/
│   │   └── +page.svelte         # Página de login
│   ├── register/
│   │   └── +page.svelte         # Página de registro
│   ├── app/
│   │   ├── +page.server.ts      # Dashboard (protegido)
│   │   └── +page.svelte
│   └── api/
│       └── auth/
│           ├── login/+server.ts
│           ├── register/+server.ts
│           └── logout/+server.ts
├── hooks.server.ts              # Middleware de auth
└── app.d.ts                     # Tipos de TypeScript
```

## 🎯 Cómo Usar en Tu Código

### Proteger rutas automáticamente

Las rutas bajo `/app/*` están protegidas automáticamente por `hooks.server.ts`.

### Obtener el usuario actual en Server Load

```typescript
// src/routes/app/books/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // locals.user está disponible si está autenticado
  console.log(locals.user.id);
  console.log(locals.user.email);
  console.log(locals.user.name);

  return {
    user: locals.user
  };
};
```

### Ejecutar queries con RLS

```typescript
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
  // SIEMPRE usa withUser() para queries de datos de usuario
  const myBooks = await withUser(locals.user.id, async (tx) => {
    return tx.select().from(books);
  });

  return { books: myBooks };
};
```

### Crear un libro (ejemplo)

```typescript
import { withUser } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = await request.json();

  const newBook = await withUser(locals.user.id, async (tx) => {
    const [book] = await tx.insert(books).values({
      ownerId: locals.user.id,
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      isOwned: true,
    }).returning();

    return book;
  });

  return json({ book: newBook });
};
```

## 🔒 Seguridad

### ✅ Lo que está protegido:

- Contraseñas hasheadas con scrypt (algoritmo seguro de Node.js)
- Sesiones con tokens criptográficamente seguros (32 bytes)
- Cookies HTTP-only (no accesibles desde JavaScript)
- RLS en base de datos (última línea de defensa)
- Validación de sesiones en cada request

### ⚠️ Pendientes para producción:

- [ ] Rate limiting en endpoints de auth
- [ ] Email verification
- [ ] Password reset
- [ ] 2FA (opcional)
- [ ] HTTPS en producción (configurar en `cookies.set`)

## 🧪 Testing

Para probar el sistema manualmente:

```bash
# Crear un usuario de prueba
curl -X POST http://localhost:5173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test12345","name":"Test User"}'

# Login
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test12345"}' \
  -c cookies.txt

# Verificar sesión (con cookies)
curl http://localhost:5173/app -b cookies.txt

# Logout
curl -X POST http://localhost:5173/api/auth/logout -b cookies.txt
```

## 📚 Próximos Pasos

Ahora que tienes autenticación funcionando, puedes:

1. Crear endpoints para gestionar libros
2. Implementar el sistema de grupos
3. Agregar contactos
4. Crear el flujo de préstamos
5. Integrar Quagga2 para escaneo de ISBN

Ver `EJEMPLOS_RLS.md` para más ejemplos de uso.

## 🆘 Problemas Comunes

### "Error de conexión a la base de datos"
- Verifica que el contenedor de PostgreSQL esté corriendo
- Revisa la `DATABASE_URL` en `.env`

### "RLS: permiso denegado"
- Asegúrate de haber ejecutado `enable-rls.sql`
- Verifica que estés usando `withUser()` en tus queries

### "Session inválida"
- Las sesiones expiran a los 30 días
- Cierra sesión y vuelve a iniciar

### "No puedo registrar usuario"
- Verifica que el email no esté ya registrado
- La contraseña debe tener mínimo 8 caracteres

## 📖 Documentación Adicional

- `RLS_SETUP.md` - Configuración detallada de RLS
- `EJEMPLOS_RLS.md` - Ejemplos de uso con RLS
- `src/lib/server/auth.ts` - Código comentado de autenticación
