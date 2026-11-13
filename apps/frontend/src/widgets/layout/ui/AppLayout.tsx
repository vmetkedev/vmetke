import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        {children}
        <Footer />
      </main>
    </div>
  );
}