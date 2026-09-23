import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Link previews resolve relative image paths against metadataBase; without it
// Next falls back to localhost and every scraped preview shows a broken image.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eideticvision.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "EideticVision — Keep the places you can't keep forever",
  description:
    "Turn meaningful places into collaborative spatial archives. Preserve a place in 3D, attach stories, photos and voices to where they happened, and move through its history with a timeline.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Eidetic Vision",
    title: "EideticVision — Keep the places you can't keep forever",
    description:
      "Preserve a meaningful place in 3D. Add the stories that happened there. Invite the people who remember it. Explore its history through time.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "EideticVision — collaborative spatial archives",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EideticVision — Keep the places you can't keep forever",
    description:
      "Preserve a meaningful place in 3D. Add the stories that happened there. Invite the people who remember it.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
