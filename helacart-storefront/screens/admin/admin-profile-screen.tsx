"use client";
import { AccountProfileEditor } from "@/components/account-profile";
import { AdminHeading } from "@/components/admin-ui";
export default function AdminProfilePage() {
  return <><AdminHeading eyebrow="YOUR ACCOUNT" title="My profile" description="Manage your details and account security." /><AccountProfileEditor admin /></>;
}
