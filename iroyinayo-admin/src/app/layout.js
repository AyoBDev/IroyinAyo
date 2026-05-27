import './globals.css';
import { ClientLayout } from './client-layout';

export const metadata = {
  title: 'IroyinMarket Admin',
  description: 'Admin dashboard for IroyinMarket',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
