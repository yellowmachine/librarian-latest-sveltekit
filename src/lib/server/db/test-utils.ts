import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

export async function setupPgliteDbForTest() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });

  // Consolidated SQL schema and RLS policies derived from schema.ts
  await pglite.exec(`
    CREATE TYPE "public"."loan_status" AS ENUM('pending', 'cancelled', 'denied', 'loaned', 'returned');

    CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "email" text NOT NULL,
      "name" text NOT NULL,
      "nick" text NOT NULL,
      "password_hash" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "users_email_unique" UNIQUE("email"),
      CONSTRAINT "users_nick_unique" UNIQUE("nick")
    );

    CREATE TABLE "sessions" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" uuid NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "groups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "created_by_id" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "user_groups" (
      "user_id" uuid NOT NULL,
      "group_id" uuid NOT NULL,
      "joined_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "user_groups_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
    );

    CREATE TABLE "books" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "owner_id" uuid NOT NULL,
      "title" text NOT NULL,
      "author" text,
      "isbn" text,
      "description" text,
      "open_library_url" text,
      "is_owned" boolean DEFAULT true NOT NULL,
      "available_for_loan" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "tags" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "created_by_id" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE "book_tags" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "book_id" uuid NOT NULL,
      "tag_id" uuid NOT NULL,
      "tagged_by_id" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "book_tags_book_id_tag_id_tagged_by_id_unique" UNIQUE("book_id","tag_id","tagged_by_id")
    );

    CREATE TABLE "shared_tags_to_groups" (
      "tag_id" uuid NOT NULL,
      "group_id" uuid NOT NULL,
      "shared_by_id" uuid NOT NULL,
      "shared_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "shared_tags_to_groups_tag_id_group_id_pk" PRIMARY KEY("tag_id","group_id")
    );
    
    CREATE TABLE "book_loans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "book_id" uuid NOT NULL,
      "requester_id" uuid NOT NULL,
      "owner_id" uuid NOT NULL,
      "status" "loan_status" DEFAULT 'pending' NOT NULL,
      "requested_at" timestamp DEFAULT now() NOT NULL,
      "responded_at" timestamp,
      "loaned_at" timestamp,
      "returned_at" timestamp,
      "notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tagged_by_id_users_id_fk" FOREIGN KEY ("tagged_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "books" ADD CONSTRAINT "books_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "shared_tags_to_groups" ADD CONSTRAINT "shared_tags_to_groups_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "shared_tags_to_groups" ADD CONSTRAINT "shared_tags_to_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "shared_tags_to_groups" ADD CONSTRAINT "shared_tags_to_groups_shared_by_id_users_id_fk" FOREIGN KEY ("shared_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "book_loans_book_idx" ON "book_loans" USING btree ("book_id");
    CREATE INDEX "book_loans_requester_idx" ON "book_loans" USING btree ("requester_id");
    CREATE INDEX "book_loans_owner_idx" ON "book_loans" USING btree ("owner_id");
    CREATE INDEX "book_loans_status_idx" ON "book_loans" USING btree ("status");
    CREATE INDEX "book_loans_composite_idx" ON "book_loans" USING btree ("requester_id","owner_id","status");
    CREATE INDEX "book_tags_book_idx" ON "book_tags" USING btree ("book_id");
    CREATE INDEX "book_tags_tag_idx" ON "book_tags" USING btree ("tag_id");
    CREATE INDEX "book_tags_tagger_idx" ON "book_tags" USING btree ("tagged_by_id");
    CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_id");
    CREATE INDEX "books_isbn_idx" ON "books" USING btree ("isbn");
    CREATE INDEX "groups_creator_idx" ON "groups" USING btree ("created_by_id");
    CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
    CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
    CREATE INDEX "shared_tags_tag_idx" ON "shared_tags_to_groups" USING btree ("tag_id");
    CREATE INDEX "shared_tags_group_idx" ON "shared_tags_to_groups" USING btree ("group_id");
    CREATE INDEX "tags_creator_idx" ON "tags" USING btree ("created_by_id");
    CREATE INDEX "tags_name_creator_idx" ON "tags" USING btree ("name","created_by_id");
    CREATE INDEX "user_groups_user_idx" ON "user_groups" USING btree ("user_id");
    CREATE INDEX "user_groups_group_idx" ON "user_groups" USING btree ("group_id");

    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    CREATE POLICY users_select_all ON users FOR SELECT TO PUBLIC USING (TRUE);
    CREATE POLICY users_update_own ON users FOR UPDATE TO PUBLIC USING (current_setting('app.user_id', true)::uuid = id);

    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY sessions_select_own ON sessions FOR SELECT TO PUBLIC USING (user_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY sessions_delete_own ON sessions FOR DELETE TO PUBLIC USING (user_id = current_setting('app.user_id', true)::uuid);

    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY groups_select_member ON groups FOR SELECT TO PUBLIC USING (id IN (SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid));
    CREATE POLICY groups_insert_own ON groups FOR INSERT TO PUBLIC WITH CHECK (created_by_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY groups_update_creator ON groups FOR UPDATE TO PUBLIC USING (created_by_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY groups_delete_creator ON groups FOR DELETE TO PUBLIC USING (created_by_id = current_setting('app.user_id', true)::uuid);

    ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY user_groups_select_member ON user_groups FOR SELECT TO PUBLIC USING (group_id IN (SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid));
    CREATE POLICY user_groups_insert_creator ON user_groups FOR INSERT TO PUBLIC WITH CHECK (group_id IN (SELECT id FROM groups WHERE created_by_id = current_setting('app.user_id', true)::uuid));
    CREATE POLICY user_groups_delete_self ON user_groups FOR DELETE TO PUBLIC USING (user_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY user_groups_delete_creator ON user_groups FOR DELETE TO PUBLIC USING (group_id IN (SELECT id FROM groups WHERE created_by_id = current_setting('app.user_id', true)::uuid));

    ALTER TABLE books ENABLE ROW LEVEL SECURITY;
    CREATE POLICY books_select_own ON books FOR SELECT TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY books_select_shared_tags ON books FOR SELECT TO PUBLIC USING (
      id IN (
        SELECT bt.book_id FROM book_tags bt
        WHERE bt.tag_id IN (
          SELECT sttg.tag_id FROM shared_tags_to_groups sttg
          WHERE sttg.group_id IN (
            SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
          )
        )
      )
    );
    CREATE POLICY books_insert_own ON books FOR INSERT TO PUBLIC WITH CHECK (owner_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY books_update_own ON books FOR UPDATE TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY books_delete_own ON books FOR DELETE TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid);

    ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tags_select_own ON tags FOR SELECT TO PUBLIC USING (created_by_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY tags_select_shared ON tags FOR SELECT TO PUBLIC USING (
      id IN (
        SELECT tag_id FROM shared_tags_to_groups
        WHERE group_id IN (
          SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
        )
      )
    );
    CREATE POLICY tags_insert_own ON tags FOR INSERT TO PUBLIC WITH CHECK (created_by_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY tags_update_own ON tags FOR UPDATE TO PUBLIC USING (created_by_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY tags_delete_own ON tags FOR DELETE TO PUBLIC USING (created_by_id = current_setting('app.user_id', true)::uuid);

    ALTER TABLE book_tags ENABLE ROW LEVEL SECURITY;
    CREATE POLICY book_tags_select_own_books ON book_tags FOR SELECT TO PUBLIC USING (book_id IN (SELECT id FROM books WHERE owner_id = current_setting('app.user_id', true)::uuid));
    CREATE POLICY book_tags_select_group_books ON book_tags FOR SELECT TO PUBLIC USING (
      book_id IN (
        SELECT b.id FROM books b
        WHERE b.owner_id IN (
          SELECT ug.user_id FROM user_groups ug
          WHERE ug.group_id IN (
            SELECT group_id FROM user_groups WHERE user_id = current_setting('app.user_id', true)::uuid
          )
        )
      )
    );
    CREATE POLICY book_tags_insert_own_books ON book_tags FOR INSERT TO PUBLIC WITH CHECK (
      tagged_by_id = current_setting('app.user_id', true)::uuid AND
      book_id IN (SELECT id FROM books WHERE owner_id = current_setting('app.user_id', true)::uuid)
    );
    CREATE POLICY book_tags_delete_own ON book_tags FOR DELETE TO PUBLIC USING (tagged_by_id = current_setting('app.user_id', true)::uuid);

    ALTER TABLE book_loans ENABLE ROW LEVEL SECURITY;
    CREATE POLICY book_loans_select_requester ON book_loans FOR SELECT TO PUBLIC USING (requester_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY book_loans_select_owner ON book_loans FOR SELECT TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid);
    CREATE POLICY book_loans_insert_request ON book_loans FOR INSERT TO PUBLIC WITH CHECK (
      requester_id = current_setting('app.user_id', true)::uuid AND
      owner_id != current_setting('app.user_id', true)::uuid AND
      status = 'pending' AND
      book_id IN (
        SELECT bt.book_id FROM book_tags bt
        WHERE bt.tag_id IN (
          SELECT sttg.tag_id FROM shared_tags_to_groups sttg
          WHERE sttg.group_id IN (
            SELECT ug1.group_id FROM user_groups ug1
            WHERE ug1.user_id = current_setting('app.user_id', true)::uuid
            INTERSECT
            SELECT ug2.group_id FROM user_groups ug2
            WHERE ug2.user_id = owner_id
          )
        )
      ) AND
      book_id IN (
        SELECT id FROM books
        WHERE is_owned = true AND available_for_loan = true
      )
    );
    CREATE POLICY book_loans_update_cancel ON book_loans FOR UPDATE TO PUBLIC USING (requester_id = current_setting('app.user_id', true)::uuid AND status = 'pending') WITH CHECK (status = 'cancelled');
    CREATE POLICY book_loans_update_owner_deny ON book_loans FOR UPDATE TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid AND status = 'pending') WITH CHECK (status = 'denied');
    CREATE POLICY book_loans_update_owner_approve ON book_loans FOR UPDATE TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid AND status = 'pending') WITH CHECK (status = 'loaned');
    CREATE POLICY book_loans_update_owner_confirm_return ON book_loans FOR UPDATE TO PUBLIC USING (owner_id = current_setting('app.user_id', true)::uuid AND status = 'loaned') WITH CHECK (status = 'returned');
  `);

  return db;
}
