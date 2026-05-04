import './globals.css';
import { ClientLayout } from './client-layout';

export const metadata = {
  title: 'Iroyinayo Admin',
  description: 'Admin dashboard for Iroyinayo WhatsApp bot',
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
