"use client";

import { Sidebar, MobileNav } from "./Sidebar";

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {title && (
          <header className="h-16 border-b border-border flex items-center px-4 md:px-8 sticky top-0 bg-background/80 backdrop-blur z-30">
            <h1 className="text-lg font-semibold">{title}</h1>
          </header>
        )}
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
