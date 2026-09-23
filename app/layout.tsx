import type { Metadata } from "next";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import PageLoadingOverlay from "@/components/PageLoadingOverlay";
import GlobalToast from "@/components/GlobalToast";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "A Certain Umazing Index | Uma Musume Comic Archive",
    template: "%s | A Certain Umazing Index",
  },
  description:
    "An archive for translated Uma Musume comics on X (Twitter) & Cubari.",
  keywords: [
    "Uma Musume",
    "Umamusume",
    "manga",
    "comics",
    "translation",
    "archive",
    "Cubari",
  ],
  authors: [{ name: "Umazing Index" }],
  creator: "Umazing Index",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://umaindex.vercel.app/", // Đổi thành domain thật của bạn
    title: "A Certain Umazing Index | Uma Musume Comic Archive",
    description:
      "An archive for translated Uma Musume comics on X (Twitter) & Cubari.",
    siteName: "A Certain Umazing Index",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "A Certain Umazing Index Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A Certain Umazing Index | Uma Musume Comic Archive",
    description:
      "An archive for translated Uma Musume comics on X (Twitter) & Cubari.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b1622] text-[#bcbec0] min-h-screen flex flex-col antialiased selection:bg-[#3db4f2]/30 selection:text-white">
        <NextTopLoader
          color="#3db4f2"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          shadow="0 0 10px #3db4f2, 0 0 5px #3db4f2"
        />

        <div className="flex-1 flex flex-col">
          <PageLoadingOverlay>
            {children}
            <GlobalToast />
          </PageLoadingOverlay>
        </div>

        <Footer />
      </body>
    </html>
  );
}
