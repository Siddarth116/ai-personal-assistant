import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { NotificationScheduler } from "@/components/layout/NotificationScheduler";

export const metadata: Metadata = {
  title: "AI Personal Assistant",
  description: "Your AI-powered productivity assistant - events, tasks, reminders, and a unified schedule.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SessionProvider>
          <ToastProvider>
            <NotificationScheduler />
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
