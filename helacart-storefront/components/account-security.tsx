"use client";
import { useState, type FormEvent } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, reload, sendEmailVerification, updatePassword, verifyBeforeUpdateEmail } from "firebase/auth";
import { errorMessage } from "@/lib/api";
import { useShop } from "./shop-provider";
import s from "./profile.module.css";

export function AccountSecurity({ previewEmail = "kasun@example.com" }: { previewEmail?: string }) {
  const { user, isPreview, refreshAccountProfile, refreshCart } = useShop();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const passwordAccount = isPreview || Boolean(user?.providerData.some((provider) => provider.providerId === "password"));
  async function verification(check: boolean) {
    if (!user || isPreview || busy) return;
    setBusy(true); setNotice(null);
    try {
      if (check) {
        await reload(user);
        await user.getIdToken(true);
        await refreshAccountProfile();
        if (user.emailVerified) await refreshCart();
        setNotice({ text: user.emailVerified ? "Your email is verified." : "Verification is still pending. Open the link in your inbox first.", error: !user.emailVerified });
      } else {
        await sendEmailVerification(user);
        setNotice({ text: "Verification email sent. Check your inbox and spam folder.", error: false });
      }
    } catch (cause) { setNotice({ text: errorMessage(cause), error: true }); }
    finally { setBusy(false); }
  }
  async function change(event: FormEvent<HTMLFormElement>, kind: "password" | "email") {
    event.preventDefault();
    if (!user?.email || isPreview || busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const current = String(fields.get("currentPassword") ?? "");
    const password = String(fields.get("newPassword") ?? "");
    const email = String(fields.get("newEmail") ?? "").trim();
    if (kind === "password" && password !== fields.get("confirmPassword")) {
      setNotice({ text: "The new passwords do not match.", error: true }); return;
    }
    if (kind === "email" && email.toLowerCase() === user.email.toLowerCase()) {
      setNotice({ text: "Enter a different email address.", error: true }); return;
    }
    setBusy(true); setNotice(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      if (kind === "password") {
        await updatePassword(user, password);
        setNotice({ text: "Password updated. Use your new password the next time you sign in.", error: false });
      } else {
        await verifyBeforeUpdateEmail(user, email);
        setNotice({ text: `A verification link was sent to ${email}. Open it to finish changing your email, then sign in again with the new address.`, error: false });
      }
      form.reset();
    } catch (cause) { setNotice({ text: errorMessage(cause), error: true }); }
    finally { setBusy(false); }
  }
  return <div className={`${s.card} ${s.security}`} id="account-security">
    <section>
      <h2>Account security</h2>
      <p>Manage the login used for your HelaCart account.</p>
      <span className={s.badge}>{isPreview || user?.emailVerified ? "Email verified" : "Email not verified"}</span>
      {notice && <div className={`${s.message} ${notice.error ? s.error : ""}`} role={notice.error ? "alert" : "status"}>{notice.text}</div>}
      <dl className={s.facts}><div><dt>Sign-in email</dt><dd>{isPreview ? previewEmail : user?.email}</dd></div><div><dt>Sign-in method</dt><dd>{passwordAccount ? "Email and password" : "Connected sign-in provider"}</dd></div></dl>
      {!user?.emailVerified && !isPreview && <div className={s.actions}><button className="outline-btn" disabled={busy} onClick={() => void verification(false)}>Send verification email</button><button className="primary-btn" disabled={busy} onClick={() => void verification(true)}>Check verification</button></div>}
    </section>
    {passwordAccount ? <>
      <section><h3>Change password</h3><p>Confirm your current password before setting a new one.</p>
        <form onSubmit={(event) => void change(event, "password")}>
          <fieldset className={s.fieldset} disabled={busy || isPreview}>
            <div className={s.fields}>
              <label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128} /></label>
              <label>New password<input type="password" name="newPassword" autoComplete="new-password" required minLength={8} maxLength={128} /><small>At least 8 characters.</small></label>
              <label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
            </div><div className={s.actions}><button className="primary-btn" type="submit">{busy ? "Please wait..." : "Update password"}</button></div>
          </fieldset>
        </form>
      </section>
      <section><h3>Change sign-in email</h3><p>The new email must be verified before your sign-in address changes.</p>
        <form onSubmit={(event) => void change(event, "email")}>
          <fieldset className={s.fieldset} disabled={busy || isPreview}>
            <div className={s.fields}><label>New email address<input type="email" name="newEmail" autoComplete="email" required maxLength={254} /></label><label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128} /></label></div>
            <div className={s.actions}><button className="outline-btn" type="submit">Verify new email</button></div>
          </fieldset>
        </form>
      </section>
    </> : <section><h3>Connected account</h3><p>Manage your password and sign-in email with your connected sign-in provider.</p></section>}
    {isPreview && <p className={s.muted}>This sample account is read-only.</p>}
  </div>;
}
