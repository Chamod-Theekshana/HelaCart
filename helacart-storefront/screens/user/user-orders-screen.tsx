import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account-dashboard";
export const metadata: Metadata = { title: "My orders" };
export default function OrdersPage() { return <AccountDashboard initialTab="orders" />; }
