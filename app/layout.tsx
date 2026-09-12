import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const viewport: Viewport = {
  themeColor: "#1A1B2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export const metadata: Metadata = {
  title: "Movie Night Matcher",
  description: "Realtime movie picks for indecisive groups. Create a room, share the code, and swipe together.",
  applicationName: "Movie Night Matcher",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Movie Matcher"
  },
  icons: {
    icon: [
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-96x96.png", sizes: "96x96", type: "image/png" }
    ],
    apple: [
      { url: "/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" }
    ],
    other: [
      { rel: "mask-icon", url: "/icon-512x512.png" }
    ]
  },
  openGraph: {
    title: "Movie Night Matcher",
    description: "Swipe on movies together. The first film everyone likes wins.",
    type: "website",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512 }]
  },
  twitter: {
    card: "summary",
    title: "Movie Night Matcher",
    description: "Swipe on movies together. The first film everyone likes wins."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
