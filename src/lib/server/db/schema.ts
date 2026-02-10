import { pgTable, uuid, text, timestamp, boolean, pgEnum, primaryKey, index, pgPolicy, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const loanStatusEnum = pgEnum('loan_status', [
  'pending',
  'cancelled',
  'denied',
  'loaned',
  'returned'
]);

export const contactStatusEnum = pgEnum('contact_status', [
  'pending',
  'accepted',
  'blocked'
]);

// ============================================================================
// TABLES CON RLS INTEGRADO
// ============================================================================

/**
 * Users table
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // RLS Policies
  pgPolicy('users_select_all', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`true`,
  }),
  pgPolicy('users_update_own', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`current_setting('app.user_id', true)::uuid = ${table.id}`,
  }),
]);

/**
 * Sessions table
 * Gestiona las sesiones de usuario para autenticación
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // Token de sesión
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sessions_user_idx').on(table.userId),
  index('sessions_expires_idx').on(table.expiresAt),
  // RLS Policies - Las sesiones se manejan sin RLS para autenticación
  pgPolicy('sessions_select_own', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.userId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('sessions_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.userId} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Contacts table (user-to-user relationships)
 * Permite gestionar contactos entre usuarios para préstamos
 */
export const contacts = pgTable('contacts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: contactStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.contactId] }),
  index('contacts_user_idx').on(table.userId),
  index('contacts_contact_idx').on(table.contactId),
  index('contacts_status_idx').on(table.status),
  // RLS Policies
  pgPolicy('contacts_select_own', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.userId} = current_setting('app.user_id', true)::uuid OR ${table.contactId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('contacts_insert_own', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`
      ${table.userId} = current_setting('app.user_id', true)::uuid AND
      ${table.contactId} != current_setting('app.user_id', true)::uuid
    `,
  }),
  pgPolicy('contacts_update_own', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`${table.contactId} = current_setting('app.user_id', true)::uuid AND ${table.status} = 'pending'`,
    withCheck: sql`${table.status} IN ('accepted', 'blocked')`,
  }),
  pgPolicy('contacts_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.userId} = current_setting('app.user_id', true)::uuid OR ${table.contactId} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Groups table
 */
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('groups_creator_idx').on(table.createdById),
  // RLS Policies
  pgPolicy('groups_select_member', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.id} IN (
      SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
  pgPolicy('groups_insert_own', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('groups_update_creator', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('groups_delete_creator', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * User-Group relationship (many-to-many)
 */
export const userGroups = pgTable('user_groups', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
  index('user_groups_user_idx').on(table.userId),
  index('user_groups_group_idx').on(table.groupId),
  // RLS Policies
  pgPolicy('user_groups_select_member', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.groupId} IN (
      SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
  pgPolicy('user_groups_insert_creator', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`${table.groupId} IN (
      SELECT id FROM groups WHERE created_by_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
  pgPolicy('user_groups_delete_self', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.userId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('user_groups_delete_creator', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.groupId} IN (
      SELECT id FROM groups WHERE created_by_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
]);

/**
 * Books table
 * Incluye tanto libros en posesión como wishlist (libros deseados)
 */
export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  author: text('author'),
  isbn: text('isbn'),
  description: text('description'),
  openLibraryUrl: text('open_library_url'),
  isOwned: boolean('is_owned').default(true).notNull(), // false para wishlist
  availableForLoan: boolean('available_for_loan').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('books_owner_idx').on(table.ownerId),
  index('books_isbn_idx').on(table.isbn),
  // RLS Policies
  pgPolicy('books_select_own', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.ownerId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('books_select_shared_tags', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`
      ${table.id} IN (
        SELECT bt.book_id FROM book_tags bt
        WHERE bt.tag_id IN (
          SELECT sttg.tag_id FROM shared_tags_to_groups sttg
          WHERE sttg.group_id IN (
            SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
          )
        )
      )
    `,
  }),
  pgPolicy('books_insert_own', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`${table.ownerId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('books_update_own', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`${table.ownerId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('books_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.ownerId} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Tags table
 */
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('tags_creator_idx').on(table.createdById),
  index('tags_name_creator_idx').on(table.name, table.createdById),
  // RLS Policies
  pgPolicy('tags_select_own', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('tags_select_shared', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.id} IN (
      SELECT tag_id FROM shared_tags_to_groups
      WHERE group_id IN (
        SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
      )
    )`,
  }),
  pgPolicy('tags_insert_own', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('tags_update_own', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('tags_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.createdById} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Book-Tag relationship
 * Un usuario puede etiquetar sus libros y los libros de users de sus grupos
 */
export const bookTags = pgTable('book_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  taggedById: uuid('tagged_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique().on(table.bookId, table.tagId, table.taggedById), // Evita duplicados
  index('book_tags_book_idx').on(table.bookId),
  index('book_tags_tag_idx').on(table.tagId),
  index('book_tags_tagger_idx').on(table.taggedById),
  // RLS Policies
  pgPolicy('book_tags_select_own_books', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.bookId} IN (
      SELECT id FROM books WHERE owner_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
  pgPolicy('book_tags_select_group_books', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.bookId} IN (
      SELECT b.id FROM books b
      WHERE b.owner_id IN (
        SELECT ug.user_id FROM user_groups ug
        WHERE ug.group_id IN (
          SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
        )
      )
    )`,
  }),
  pgPolicy('book_tags_insert_own_books', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`
      ${table.taggedById} = current_setting('app.user_id', true)::uuid AND
      ${table.bookId} IN (SELECT id FROM books WHERE owner_id = current_setting('app.user_id', true)::uuid)
    `,
  }),
  pgPolicy('book_tags_insert_group_books', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`
      ${table.taggedById} = current_setting('app.user_id', true)::uuid AND
      ${table.bookId} IN (
        SELECT b.id FROM books b
        WHERE b.owner_id IN (
          SELECT ug.user_id FROM user_groups ug
          WHERE ug.group_id IN (
            SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
          )
        )
      )
    `,
  }),
  pgPolicy('book_tags_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.taggedById} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Shared tags to groups
 * Un usuario puede compartir los tags de sus libros a grupos
 */
export const sharedTagsToGroups = pgTable('shared_tags_to_groups', {
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  sharedById: uuid('shared_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sharedAt: timestamp('shared_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.tagId, table.groupId] }),
  index('shared_tags_tag_idx').on(table.tagId),
  index('shared_tags_group_idx').on(table.groupId),
  // RLS Policies
  pgPolicy('shared_tags_select_member', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.groupId} IN (
      SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
    )`,
  }),
  pgPolicy('shared_tags_insert_own', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`
      ${table.sharedById} = current_setting('app.user_id', true)::uuid AND
      ${table.tagId} IN (SELECT id FROM tags WHERE created_by_id = current_setting('app.user_id', true)::uuid) AND
      ${table.groupId} IN (SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid)
    `,
  }),
  pgPolicy('shared_tags_delete_own', {
    for: 'delete',
    to: 'PUBLIC',
    using: sql`${table.sharedById} = current_setting('app.user_id', true)::uuid`,
  }),
]);

/**
 * Book loans/requests
 * Un user puede pedir prestado un libro a otro user que está en sus grupos
 */
export const bookLoans = pgTable('book_loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: loanStatusEnum('status').default('pending').notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
  loanedAt: timestamp('loaned_at'),
  returnedAt: timestamp('returned_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('book_loans_book_idx').on(table.bookId),
  index('book_loans_requester_idx').on(table.requesterId),
  index('book_loans_owner_idx').on(table.ownerId),
  index('book_loans_status_idx').on(table.status),
  index('book_loans_composite_idx').on(table.requesterId, table.ownerId, table.status),
  // RLS Policies
  pgPolicy('book_loans_select_requester', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.requesterId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('book_loans_select_owner', {
    for: 'select',
    to: 'PUBLIC',
    using: sql`${table.ownerId} = current_setting('app.user_id', true)::uuid`,
  }),
  pgPolicy('book_loans_insert_request', {
    for: 'insert',
    to: 'PUBLIC',
    withCheck: sql`
      ${table.requesterId} = current_setting('app.user_id', true)::uuid AND
      ${table.ownerId} != current_setting('app.user_id', true)::uuid AND
      ${table.status} = 'pending' AND
      -- Validar que sean contactos aceptados
      EXISTS (
        SELECT 1 FROM contacts c
        WHERE (
          (c.user_id = current_setting('app.user_id', true)::uuid AND c.contact_id = ${table.ownerId})
          OR (c.user_id = ${table.ownerId} AND c.contact_id = current_setting('app.user_id', true)::uuid)
        )
        AND c.status = 'accepted'
      ) AND
      -- Validar que el libro tenga una etiqueta compartida en un grupo común
      ${table.bookId} IN (
        SELECT bt.book_id FROM book_tags bt
        WHERE bt.tag_id IN (
          SELECT sttg.tag_id FROM shared_tags_to_groups sttg
          WHERE sttg.group_id IN (
            SELECT ug1.group_id FROM user_groups ug1
            WHERE ug1.user_id = current_setting('app.user_id', true)::uuid
            INTERSECT
            SELECT ug2.group_id FROM user_groups ug2
            WHERE ug2.user_id = ${table.ownerId}
          )
        )
      ) AND
      -- Validar que el libro sea owned y esté disponible
      ${table.bookId} IN (
        SELECT id FROM books
        WHERE is_owned = true AND available_for_loan = true
      )
    `,
  }),
  pgPolicy('book_loans_update_cancel', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`
      ${table.requesterId} = current_setting('app.user_id', true)::uuid AND
      ${table.status} = 'pending'
    `,
    withCheck: sql`${table.status} = 'cancelled'`,
  }),
  pgPolicy('book_loans_update_owner_deny', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`
      ${table.ownerId} = current_setting('app.user_id', true)::uuid AND
      ${table.status} = 'pending'
    `,
    withCheck: sql`${table.status} = 'denied'`,
  }),
  pgPolicy('book_loans_update_owner_approve', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`
      ${table.ownerId} = current_setting('app.user_id', true)::uuid AND
      ${table.status} = 'pending'
    `,
    withCheck: sql`${table.status} = 'loaned'`,
  }),
  pgPolicy('book_loans_update_owner_confirm_return', {
    for: 'update',
    to: 'PUBLIC',
    using: sql`
      ${table.ownerId} = current_setting('app.user_id', true)::uuid AND
      ${table.status} = 'loaned'
    `,
    withCheck: sql`${table.status} = 'returned'`,
  }),
]);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  userGroups: many(userGroups),
  ownedBooks: many(books),
  createdTags: many(tags),
  taggedBooks: many(bookTags),
  requestedLoans: many(bookLoans, { relationName: 'requester' }),
  receivedLoanRequests: many(bookLoans, { relationName: 'owner' }),
  createdGroups: many(groups),
  sharedTags: many(sharedTagsToGroups),
  initiatedContacts: many(contacts, { relationName: 'user' }),
  receivedContacts: many(contacts, { relationName: 'contact' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: 'user',
  }),
  contact: one(users, {
    fields: [contacts.contactId],
    references: [users.id],
    relationName: 'contact',
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdById],
    references: [users.id],
  }),
  userGroups: many(userGroups),
  sharedTags: many(sharedTagsToGroups),
}));

export const userGroupsRelations = relations(userGroups, ({ one }) => ({
  user: one(users, {
    fields: [userGroups.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [userGroups.groupId],
    references: [groups.id],
  }),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  owner: one(users, {
    fields: [books.ownerId],
    references: [users.id],
  }),
  bookTags: many(bookTags),
  loans: many(bookLoans),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  creator: one(users, {
    fields: [tags.createdById],
    references: [users.id],
  }),
  bookTags: many(bookTags),
  sharedToGroups: many(sharedTagsToGroups),
}));

export const bookTagsRelations = relations(bookTags, ({ one }) => ({
  book: one(books, {
    fields: [bookTags.bookId],
    references: [books.id],
  }),
  tag: one(tags, {
    fields: [bookTags.tagId],
    references: [tags.id],
  }),
  tagger: one(users, {
    fields: [bookTags.taggedById],
    references: [users.id],
  }),
}));

export const sharedTagsToGroupsRelations = relations(sharedTagsToGroups, ({ one }) => ({
  tag: one(tags, {
    fields: [sharedTagsToGroups.tagId],
    references: [tags.id],
  }),
  group: one(groups, {
    fields: [sharedTagsToGroups.groupId],
    references: [groups.id],
  }),
  sharedBy: one(users, {
    fields: [sharedTagsToGroups.sharedById],
    references: [users.id],
  }),
}));

export const bookLoansRelations = relations(bookLoans, ({ one }) => ({
  book: one(books, {
    fields: [bookLoans.bookId],
    references: [books.id],
  }),
  requester: one(users, {
    fields: [bookLoans.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  owner: one(users, {
    fields: [bookLoans.ownerId],
    references: [users.id],
    relationName: 'owner',
  }),
}));
