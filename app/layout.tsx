import type { Metadata } from 'next';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
import PageLoadingOverlay from '@/components/PageLoadingOverlay';

export const metadata: Metadata = {
  title: 'UmaIndex - Uma Musume Translated Comic Archive',
  description: 'Archive of translated Uma Musume comics from X (Twitter)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b1622] text-[#bcbec0] min-h-screen">
        <NextTopLoader
          color="#3db4f2"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          shadow="0 0 10px #3db4f2, 0 0 5px #3db4f2"
        />
        <PageLoadingOverlay>
          {children}
        </PageLoadingOverlay>
      </body>
    </html>
  );
}