import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans", // keeping the same CSS variable name so we don't break tailwind config elsewhere
  display: "swap",
  preload: false,
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "SmartMess",
  description: "Manage your daily meals effortlessly",
  icons: {
    icon: [
      { url: "/smartmess_logo_vector.svg", type: "image/svg+xml" },
    ],
    shortcut: "/smartmess_logo_vector.svg",
    apple: "/smartmess_logo_vector.svg",
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
      className={`${manrope.variable} ${fraunces.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css"
        />
      </head>
      <body className="min-h-screen bg-cream text-espresso font-sans w-full max-w-full overflow-x-clip" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}