import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wuthering Waves Optimizer | Tower of Adversity 3.7",
  description: "Deterministic team-building and Tower of Adversity optimization engine for Wuthering Waves 3.7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
