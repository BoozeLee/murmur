import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Murmur",
  description: "An idea deck for painting. One card at a time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <div
          aria-hidden
          className="murmur-glow pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_-10%,#262335_0%,transparent_70%)]"
        />
        {children}
      </body>
    </html>
  );
}