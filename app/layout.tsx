import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "Mind the Map";
const siteDescription =
  "Create a fictional London Tube line from real stations, colour it, name it, and export a shareable map.";
const cloudflareWebAnalyticsSiteToken = "de2a228a7f21477bbb37ab73a081de4f";
const cloudflareWebAnalyticsToken =
  process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim() ||
  cloudflareWebAnalyticsSiteToken;

async function getRequestBaseUrl() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol ?? (host.includes("localhost") ? "http" : "https");

  return new URL(`${protocol}://${host}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestBaseUrl();
  const imageUrl = new URL("/og.svg", metadataBase).toString();

  return {
    metadataBase,
    title: siteTitle,
    description: siteDescription,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: siteTitle,
      description: siteDescription,
      url: "/",
      siteName: siteTitle,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "Mind the Map launch card with a fictional line map.",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [imageUrl],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {cloudflareWebAnalyticsToken ? (
          <Script
            data-cf-beacon={JSON.stringify({
              token: cloudflareWebAnalyticsToken,
            })}
            id="cloudflare-web-analytics"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            type="module"
          />
        ) : null}
      </body>
    </html>
  );
}
