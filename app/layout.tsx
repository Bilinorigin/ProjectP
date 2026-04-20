import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatchBase // Tactical Patch Generator",
  description:
    "AI-powered design studio for military and tactical morale patches.",
};

export const viewport: Viewport = {
  themeColor: "#0B0F0E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-tactical-bg text-tactical-text antialiased">
        {children}
      </body>
    </html>
  );
}
