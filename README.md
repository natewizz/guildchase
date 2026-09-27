# Guildchase

MTG basic-lands collection tracker. The public site shows one owner's collection. That owner can sign in and mark cards owned.

Next.js runs on Vercel. Postgres, login, and row security run on Supabase.

## One-time setup

1. Create a [Supabase](https://supabase.com) project.
2. In the SQL editor, run [`supabase/migrations/20260927120000_init.sql`](supabase/migrations/20260927120000_init.sql).
3. In Authentication → Providers → Email, turn off "Confirm email" so the single owner can sign in immediately. Create the user under Authentication → Users.
4. Promote that user:

   ```sql
   update public.profiles set role = 'owner' where email = 'you@example.com';
   ```

5. Copy `.env.example` to `.env.local` for the app, and to `.env` for the sync scripts. Fill in the project URL, the anon key, and the service role key. The service role key stays on your machine. Vercel only needs the URL and the anon key.

## Load the catalog

```bash
npm install
npm run sync -- --discover --prune
```

`--discover` asks Scryfall which paper sets contain basic lands and inserts those cards. It waits half a second between requests, so the first run takes a while. `--prune` removes non-basic printings and sets that end up empty. Ownership rows are left alone.

Later, when a new set releases:

```bash
npm run sync -- --discover
```

To refresh cards already in the database:

```bash
npm run sync
```

## Bring over owned cards from the Laravel database

Add `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` to `.env`, then:

```bash
npm run import-ownership
```

Cards match on set code, collector number, and variant. Passwords are not copied.

## Run it

```bash
npm run dev
```

Sign in as the owner to toggle cards. Everyone else can browse the collection.

## Deploy

Import this repo in Vercel. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not add the service role key to Vercel.
