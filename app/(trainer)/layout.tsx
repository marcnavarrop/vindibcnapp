import { AppShell } from "@/components/app-shell";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="trainer">{children}</AppShell>;
}
