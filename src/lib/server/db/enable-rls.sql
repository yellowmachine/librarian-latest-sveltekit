-- ============================================================================
-- SCRIPT PARA HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================
-- Ejecutar DESPUÉS de las migraciones de Drizzle
-- Para desarrollo local: psql -U librarian -d librarian -f enable-rls.sql
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_tags_to_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_loans ENABLE ROW LEVEL SECURITY;

-- FORCE RLS: Aplica las políticas incluso al owner de las tablas
-- Esto es IMPORTANTE para desarrollo, de lo contrario tu user de postgres
-- puede bypassear las políticas
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE groups FORCE ROW LEVEL SECURITY;
ALTER TABLE user_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE books FORCE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;
ALTER TABLE book_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE shared_tags_to_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE book_loans FORCE ROW LEVEL SECURITY;

-- Verificar que RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled",
  forcerowsecurity as "RLS Forced"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
