import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account-dashboard";
export const metadata: Metadata = { title: "Account security" };
export default function SecurityPage() { return <AccountDashboard initialTab="security" />; }
