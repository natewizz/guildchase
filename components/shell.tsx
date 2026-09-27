"use client";

import { logout } from "@/app/actions";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Shell({ email }: { email: string | null }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") === "light" ? "light" : "dark";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <>
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" type="button">
        <span>{theme === "dark" ? "🌙" : "☀️"}</span>
      </button>
      <div className="auth-links">
        <Link href="/">Sets</Link>
        <Link href="/dashboard">Dashboard</Link>
        {email ? (
          <>
            <span className="auth-email">{email}</span>
            <form action={logout}>
              <button type="submit" className="link-button">Logout</button>
            </form>
          </>
        ) : (
          <Link href="/login">Login</Link>
        )}
      </div>
    </>
  );
}
