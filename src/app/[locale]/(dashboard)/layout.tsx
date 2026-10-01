import { AuthGate } from "@/components/auth/AuthGate";

export const instant = false;

export const metadata = { robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
