import { getViewer } from "@/lib/auth";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTG Lands Collection",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/keyrune@latest/css/keyrune.min.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: "try{document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')||'dark')}catch(e){}",
          }}
        />
      </head>
      <body>
        <Shell email={viewer.email} />
        {children}
      </body>
    </html>
  );
}
