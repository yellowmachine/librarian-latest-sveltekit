import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { setupPgliteDbForTest } from './test-utils';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

// Helper to set session variable
async function setUserId(db: any, userId: string | null) {
  if (userId) {
    await db.session.execute(sql`SET app.user_id = ${userId}`);
  } else {
    await db.session.execute(sql`RESET app.user_id`);
  }
}

describe('RLS Tests with pglite', () => {
  let db: Awaited<ReturnType<typeof setupPgliteDbForTest>>;
  let user1Id: string;
  let user2Id: string;
  let book1ByUser1: string;
  let book2ByUser1: string;
  let book3ByUser2: string;
  let group1Id: string;
  let tag1Id: string;

  beforeAll(async () => {
    // Setup the database once for all tests in this describe block
    // Each 'it' block will run in its own transaction (if supported by pglite + vitest)
    // or you can call setupPgliteDbForTest in a beforeEach for full isolation
    db = await setupPgliteDbForTest();

    // Insert some initial data
    const usersData = await db.insert(schema.users).values([
      { email: 'user1@example.com', name: 'User One', nick: 'user1', passwordHash: 'hash1' },
      { email: 'user2@example.com', name: 'User Two', nick: 'user2', passwordHash: 'hash2' },
    ]).returning({ id: schema.users.id });
    user1Id = usersData[0].id;
    user2Id = usersData[1].id;

    const booksData = await db.insert(schema.books).values([
      { ownerId: user1Id, title: 'Book 1 by User 1', author: 'Author A', isbn: '111', description: 'Desc 1' },
      { ownerId: user1Id, title: 'Book 2 by User 1', author: 'Author B', isbn: '222', description: 'Desc 2' },
      { ownerId: user2Id, title: 'Book 3 by User 2', author: 'Author C', isbn: '333', description: 'Desc 3' },
    ]).returning({ id: schema.books.id });
    book1ByUser1 = booksData[0].id;
    book2ByUser1 = booksData[1].id;
    book3ByUser2 = booksData[2].id;

    // Create a group
    const groupsData = await db.insert(schema.groups).values([
      { createdById: user1Id, name: 'Shared Group', description: 'A group for sharing' }
    ]).returning({ id: schema.groups.id });
    group1Id = groupsData[0].id;

    // Add both users to the group
    await db.insert(schema.userGroups).values([
      { userId: user1Id, groupId: group1Id },
      { userId: user2Id, groupId: group1Id },
    ]);

    // User 1 creates a tag
    const tagsData = await db.insert(schema.tags).values([
      { createdById: user1Id, name: 'My Shared Tag' }
    ]).returning({ id: schema.tags.id });
    tag1Id = tagsData[0].id;

    // User 1 tags their book with 'My Shared Tag'
    await db.insert(schema.bookTags).values([
      { bookId: book1ByUser1, tagId: tag1Id, taggedById: user1Id }
    ]);

    // User 1 shares 'My Shared Tag' with 'Shared Group'
    await db.insert(schema.sharedTagsToGroups).values([
      { tagId: tag1Id, groupId: group1Id, sharedById: user1Id }
    ]);

  });

  afterEach(async () => {
    // Reset the app.user_id after each test to ensure isolation of session settings
    await setUserId(db, null);
  });

  it('should allow user1 to see their own books', async () => {
    await setUserId(db, user1Id);
    const books = await db.select().from(schema.books);
    expect(books).toHaveLength(2);
    expect(books.map(b => b.id)).toContain(book1ByUser1);
    expect(books.map(b => b.id)).toContain(book2ByUser1);
  });

  it('should allow user2 to see their own books', async () => {
    await setUserId(db, user2Id);
    const books = await db.select().from(schema.books);
    expect(books).toHaveLength(1);
    expect(books.map(b => b.id)).toContain(book3ByUser2);
  });

  it('should allow user1 to see books shared by user1 in a common group', async () => {
    await setUserId(db, user2Id); // User 2 is in the group
    const books = await db.select().from(schema.books);
    // User 2 should see their own book (book3ByUser2) AND book1ByUser1 (because it's shared via tag in common group)
    expect(books).toHaveLength(2);
    expect(books.map(b => b.id)).toContain(book3ByUser2);
    expect(books.map(b => b.id)).toContain(book1ByUser1);
  });

  it('should not allow an unauthenticated user to see any books', async () => {
    await setUserId(db, null); // No user authenticated
    const books = await db.select().from(schema.books);
    expect(books).toHaveLength(0);
  });

  it('should allow user1 to see their own tags', async () => {
    await setUserId(db, user1Id);
    const tags = await db.select().from(schema.tags);
    expect(tags).toHaveLength(1);
    expect(tags.map(t => t.id)).toContain(tag1Id);
  });

  it('should allow user2 to see tags shared by user1 in a common group', async () => {
    await setUserId(db, user2Id);
    const tags = await db.select().from(schema.tags);
    // User 2 should see the tag shared by user1 in the common group
    expect(tags).toHaveLength(1);
    expect(tags.map(t => t.id)).toContain(tag1Id);
  });

  it('should prevent user2 from inserting book tags for book1ByUser1 (user1s book), even in a common group', async () => {
    await setUserId(db, user2Id);
    const result = await db.insert(schema.bookTags).values({
      bookId: book1ByUser1, // User 1's book
      tagId: tag1Id,
      taggedById: user2Id // User 2 trying to tag
    }).returning().catch(e => e); // Catch potential RLS error

    // Expect an error because RLS policy `book_tags_insert_own_books` should prevent this.
    // PGLite might throw a generic error, or a specific RLS error.
    expect(result).toBeInstanceOf(Error);
  });

  // TODO: Add more tests for group creation, membership, loan requests, etc.
});
