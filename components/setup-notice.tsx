export function SetupNotice({ detail }: { detail?: string }) {
  const connected = Boolean(detail);
  return (
    <div className="stats-bar setup-notice">
      <h1>{connected ? "Run the database setup" : "Connect Supabase"}</h1>
      <p>
        {connected
          ? "The Supabase project is connected. The collection tables are not created yet."
          : "The app is ready. It needs a Supabase project before the collection can load."}
      </p>
      <ol>
        <li>Create a project at supabase.com.</li>
        <li>Open the SQL editor and run <code>supabase/migrations/20260927120000_init.sql</code>.</li>
        <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in the URL and publishable key.</li>
        <li>In Authentication, create the owner user and turn off email confirmation for that user.</li>
        <li>Run <code>update public.profiles set role = &apos;owner&apos; where email = &apos;you@example.com&apos;;</code></li>
        <li>Run <code>npm run sync -- --discover</code> to load basic lands from Scryfall.</li>
      </ol>
      {detail ? <p className="setup-error">{detail}</p> : null}
    </div>
  );
}
