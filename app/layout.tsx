import type { Metadata, Viewport } from 'next';
import { Inter, Archivo, JetBrains_Mono, Nothing_You_Could_Do, Graduate } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });
const script = Nothing_You_Could_Do({ subsets: ['latin'], weight: '400', variable: '--font-script', display: 'swap' });
const graduate = Graduate({ subsets: ['latin'], weight: '400', variable: '--font-graduate', display: 'swap' });

export const metadata: Metadata = {
  title: 'FDRHS Robotics Hub',
  description: 'The FDR Cougars robotics engineering hub — AI Build Mentor, 3D robot design, printing, parts and VEX Code.',
  icons: { icon: '/brand/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#C8061C' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${mono.variable} ${script.variable} ${graduate.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
