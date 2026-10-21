import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account-dashboard";
export const metadata: Metadata = { title: "My profile" };
export default function ProfilePage() { return <AccountDashboard initialTab="profile" />; }
