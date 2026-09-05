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

export const metadata: Metadata = {
  title: "EideticVision — Keep the places you can't keep forever",
  description:
    "Turn meaningful places into collaborative spatial archives. Preserve a place in 3D, attach stories, photos and voices to where they happened, and move through its history with a timeline.",
  openGraph: {
    title: "EideticVision — Keep the places you can't keep forever",
    description:
      "Preserve a meaningful place in 3D. Add the stories that happened there. Invite the people who remember it. Explore its history through time.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "EideticVision — collaborative spatial archives",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EideticVision — Keep the places you can't keep forever",
    description:
      "Preserve a meaningful place in 3D. Add the stories that happened there. Invite the people who remember it.",
    images: ["/opengraph-image.png"],
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
