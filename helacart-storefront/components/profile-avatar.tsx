"use client";
/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/profile";
import { useShop } from "./shop-provider";
import s from "./profile.module.css";

export function ProfileAvatar({ name, small = false }: { name: string; small?: boolean }) {
  const { profilePhotoUrl } = useShop();
  return <span className={`${s.avatar} ${small ? s.smallAvatar : ""}`} aria-hidden="true">
    {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" /> : initials(name)}
  </span>;
}
