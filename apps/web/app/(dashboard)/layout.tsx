import { ThemeProvider } from "@/components/shell/theme-provider";
import { AppShell } from "@/components/shell/app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
