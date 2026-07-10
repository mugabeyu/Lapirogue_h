import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { Inter, Rajdhani } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-rajdhani',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'La Pirogue Hotel Operations',
  description: 'Enterprise Hotel Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${rajdhani.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
