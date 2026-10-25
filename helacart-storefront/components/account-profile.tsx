"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { previewAccount, type AccountProfile } from "@/lib/profile";
import { useShop } from "./shop-provider";
import { ProfileAvatar } from "./profile-avatar";
import { AccountSecurity } from "./account-security";
import s from "./profile.module.css";

export function AccountProfileEditor({ admin = false }: { admin?: boolean }) {
  const { accountProfile, profileError, refreshAccountProfile, isPreview, user } = useShop();
  const profile = isPreview ? { ...previewAccount, ...(admin ? { name: "HelaCart Admin", email: "admin@example.com" } : {}) } : accountProfile;
  if (!profile) return <div className={s.card} role={profileError ? "alert" : "status"}>
    <h2>{profileError ? "Could not load your profile" : "Loading your profile..."}</h2>
    {profileError && <><p>{profileError}</p><button className="outline-btn" onClick={() => void refreshAccountProfile()}>Try again</button></>}
    {!user && !isPreview && <Link href="/auth" className="primary-btn">Sign in</Link>}
  </div>;
  return <div className={s.layout}>
    <ProfileForm key={profile.firebaseUid} profile={profile} admin={admin} />
    <div className={s.stack}>
      <section className={s.card}><h2>{admin ? "Administrator account" : "Your account"}</h2><p>{admin ? "Your assigned access stays linked to your sign-in account." : "Keep your details current for a smoother shopping experience."}</p>
        <span className={s.badge}><BadgeCheck size={14} />{profile.emailVerified ? "Email verified" : "Verification pending"}</span>
        <dl className={s.facts}>
          <div><dt>Member since</dt><dd>{new Intl.DateTimeFormat("en-LK", { timeZone: "Asia/Colombo", dateStyle: "medium" }).format(new Date(profile.createdAt))}</dd></div>
          <div><dt>Account type</dt><dd>{admin ? "Authorized administrator" : "Buyer"}</dd></div>
          <div><dt>Visibility</dt><dd>Your contact details and photo are private.</dd></div>
        </dl>
        {!admin && <div className={s.links}><Link href="/account">View orders</Link><Link href="/account/returns">Track returns</Link><Link href="/account/security">Manage login and security</Link></div>}
      </section>
      {admin && <section className={s.card}><h3><ShieldCheck size={17} /> Admin access</h3><p>Permissions are assigned by the platform owner. Editing this profile does not change your access.</p></section>}
    </div>
    {admin && <div className={s.fullWidth}><AccountSecurity previewEmail="admin@example.com" /></div>}
  </div>;
}

function ProfileForm({ profile, admin }: { profile: AccountProfile; admin: boolean }) {
  const { user, isPreview, setAccountProfile } = useShop();
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const disabled = busy || isPreview || !profile.emailVerified;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || disabled) return;
    setBusy(true); setNotice(null);
    try {
      const updated = await api<AccountProfile>("/auth/me", { method: "PATCH", token: await user.getIdToken(), body: { name: name.trim(), phone: phone.trim() } });
      setAccountProfile(updated); setName(updated.name ?? ""); setPhone(updated.phone ?? "");
      setNotice({ text: "Profile saved.", error: false });
    } catch (cause) { setNotice({ text: errorMessage(cause), error: true }); }
    finally { setBusy(false); }
  }
  async function photo(file: File | null) {
    if (!user || disabled) return;
    setBusy(true); setNotice(null);
    try {
      if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 3 * 1024 * 1024))
        throw new Error("Choose a JPEG, PNG or WebP photo up to 3 MB.");
      const body = file ? new FormData() : undefined;
      if (file) body!.append("photo", file);
      const updated = await api<AccountProfile>("/auth/me/photo", { method: file ? "POST" : "DELETE", token: await user.getIdToken(), body });
      setAccountProfile(updated);
      setNotice({ text: file ? "Profile photo updated." : "Profile photo removed.", error: false });
    } catch (cause) { setNotice({ text: errorMessage(cause), error: true }); }
    finally { setBusy(false); }
  }
  return <section className={s.card}>
    <h2>{admin ? "My admin profile" : "My profile"}</h2><p>Your personal details and profile photo.</p>
    {notice && <div className={`${s.message} ${notice.error ? s.error : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
    {!profile.emailVerified && <div className={s.message}>Verify your email in account security before editing your profile.</div>}
    <div className={s.photoRow}>
      <ProfileAvatar name={profile.name ?? profile.email} />
      <div className={s.photoControls}><label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) void photo(file); event.target.value = ""; }} /></label><small className={s.muted}>JPEG, PNG or WebP, up to 3 MB. Optional.</small>{profile.hasPhoto && <button className={s.textButton} disabled={disabled} onClick={() => void photo(null)}>Remove photo</button>}</div>
    </div>
    <form onSubmit={(event) => void save(event)}>
      <div className={s.fields}>
        <label>Full name<input autoComplete="name" required minLength={2} maxLength={100} value={name} disabled={disabled} onChange={(event) => setName(event.target.value)} /></label>
        <label>Phone number<input type="tel" autoComplete="tel" maxLength={25} value={phone} disabled={disabled} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. +94 77 123 4567" /><small>{admin ? "Optional account contact number." : "Optional. Delivery addresses keep their own contact number."}</small></label>
        <label>Email address<input type="email" autoComplete="email" value={profile.email} disabled /><small>Change your sign-in email in account security.</small></label>
      </div>
      <div className={s.actions}><button className="primary-btn" type="submit" disabled={disabled}>{busy ? "Saving..." : "Save profile"}</button><button className="outline-btn" type="button" disabled={disabled} onClick={() => { setName(profile.name ?? ""); setPhone(profile.phone ?? ""); setNotice(null); }}>Reset</button></div>
      {isPreview && <p className={s.muted}>Connect the API and sign in to save your own profile.</p>}
    </form>
  </section>;
}
