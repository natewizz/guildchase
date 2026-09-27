"use client";

import { login } from "@/app/actions";
import Link from "next/link";
import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="login-wrap">
      <h1>Login</h1>
      <div className="stats-bar login-card">
        <form action={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
      <div className="login-back">
        <Link href="/">← Back to Collection</Link>
      </div>
    </div>
  );
}
