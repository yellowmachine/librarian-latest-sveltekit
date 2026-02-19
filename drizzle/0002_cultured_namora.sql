ALTER POLICY "book_loans_insert_request" ON "book_loans" TO PUBLIC WITH CHECK (
      "book_loans"."requester_id" = current_setting('app.user_id', true)::uuid AND
      "book_loans"."owner_id" != current_setting('app.user_id', true)::uuid AND
      "book_loans"."status" = 'pending' AND
      );