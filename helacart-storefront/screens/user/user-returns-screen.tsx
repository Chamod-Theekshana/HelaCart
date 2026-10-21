import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account-dashboard";
export const metadata: Metadata = { title: "My return requests" };
export default function ReturnsPage() {
  return <AccountDashboard initialTab="returns" />;
}
