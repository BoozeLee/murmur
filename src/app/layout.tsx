import type { Metadata } from "next";

import { LivingMurmur } from "@/components/living-murmur";

import "./globals.css";

export const metadata: Metadata = {
  title: "Murmur — one painting idea at a time",
  description:
    "A small deck of painting ideas: what to make, where the light comes from, and one line to read from the easel.",
  openGraph: {
    title: "Murmur",
    description: "One idea at a time. Take it or leave it.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body className="relative min-h-dvh overflow-x-hidden antialiased">
        <div
          aria-hidden
          className="wash pointer-events-none fixed -left-48 -top-72 h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(circle,var(--color-teal),transparent_66%)] opacity-25 blur-3xl"
        />
        <div
          aria-hidden
          className="wash pointer-events-none fixed -right-56 -top-52 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,var(--color-ochre),transparent_66%)] opacity-20 blur-3xl [animation-delay:-11s]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-0 h-64 bg-[linear-gradient(0deg,var(--color-forest),transparent)] opacity-25"
        />
        <LivingMurmur />
        {children}
      </body>
    </html>
  );
}
