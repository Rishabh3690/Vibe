import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Vibe — Studio Mastering, 400% Loudness & Kinetic Stage",
  description:
    "Upload any song for real-time psychoacoustic mastering, 25 studio profiles, 4-level 400% distortion-free loudness boost, and distraction-free fullscreen listening.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vibe",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Vibe — Studio Mastering, 400% Loudness & Kinetic Stage",
    description:
      "Upload any song for real-time psychoacoustic mastering, 25 studio profiles, 4-level 400% distortion-free loudness boost, and distraction-free fullscreen listening.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibe — Studio Mastering, 400% Loudness & Kinetic Stage",
    description:
      "Upload any song for real-time psychoacoustic mastering, 25 studio profiles, 4-level 400% distortion-free loudness boost, and distraction-free fullscreen listening.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#0A0A0B] text-[#EDEDED] antialiased selection:bg-[#14B8A6] selection:text-[#0A0A0B]"
      >
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
