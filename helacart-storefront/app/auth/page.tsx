"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, LockKeyhole, Mail, ShieldCheck, Truck } from "lucide-react";
import { createUserWithEmailAndPassword, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { errorMessage } from "@/lib/api";
import { clientAuth, hasFirebase } from "@/lib/firebase";
import { useShop } from "@/components/shop-provider";

export default function AuthPage() {
  const router = useRouter();
  const { user, refreshCart } = useShop();
  const [mode, setMode] = useState<"sign-in" | "register" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const auth = clientAuth();
    if (!auth) return;
    setBusy(true); setNotice(""); setError("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setNotice("If this email has an account, a password reset link has been sent.");
      } else if (mode === "register") {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(created.user);
        setNotice("Account created. Please use the verification link in your email before shopping.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/account");
      }
    } catch (issue) { setError(errorMessage(issue)); }
    finally { setBusy(false); }
  }
  async function checkVerification() {
    if (!user) return;
    setBusy(true); setError("");
    try {
      await reload(user); await user.getIdToken(true);
      if (user.emailVerified) await refreshCart();
      setNotice(user.emailVerified ? "Email verified. You're ready to shop." : "Still waiting for verification. Check your inbox and try again.");
      router.refresh();
    } catch (issue) { setError(errorMessage(issue)); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="container">
    <div className="auth-card">
      <span className="auth-emblem"><ShieldCheck size={23} /></span>
      <span className="section-kicker">HELACART BUYER ACCOUNT</span>
      <h1>{mode === "reset" ? "Reset your password" : "Welcome to HelaCart"}</h1>
      <p>Shop and manage your orders in one place.</p>
      {user && <div className="message success">Signed in as {user.email}. {user.emailVerified ? "Your email is verified." : "Please verify your email before shopping."}
        {!user.emailVerified && <button className="inline-action" disabled={busy} onClick={checkVerification}>I have verified my email</button>}
      </div>}
      {mode !== "reset" && <div className="auth-tabs"><button className={mode === "sign-in" ? "active" : ""} onClick={() => { setMode("sign-in"); setError(""); }}>Sign In</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create Account</button></div>}
      <form onSubmit={submit}>
        <label>Email address<div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
        {mode !== "reset" && <label>Password<div className="input-with-icon"><LockKeyhole size={18} /><input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></div></label>}
        {mode === "sign-in" && <button className="forgot-link" type="button" onClick={() => setMode("reset")}>Forgot password?</button>}
        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}
        {!hasFirebase && <div className="message info">Account sign-in is not configured in this preview. Add the Firebase web settings to enable it.</div>}
        <button className="primary-btn auth-submit" type="submit" disabled={busy || !hasFirebase}>{busy ? "Please wait..." : mode === "reset" ? "Send reset link" : mode === "register" ? "Create Account" : "Sign In to HelaCart"} <ArrowRight size={17} /></button>
      </form>
      {mode === "reset" && <button className="text-link auth-return" onClick={() => setMode("sign-in")}>Back to sign in</button>}
      <div className="auth-card-bottom"><span><Banknote size={19} /> Cash on delivery</span><span><Truck size={19} /> Sri Lankan marketplace</span></div>
    </div>
    <div className="auth-support"><div><ShieldCheck size={24} /><strong>Made for local shopping</strong><p>Find products from sellers across Sri Lanka.</p></div><div><Banknote size={24} /><strong>Pay when your order arrives</strong><p>Review the full amount before placing a COD order.</p></div><div><Truck size={24} /><strong>Manage your orders</strong><p>Keep delivery details and order history in one account.</p></div></div>
    <p className="auth-disclaimer"><Link href="/products">Continue browsing without an account</Link></p>
  </div></div>;
}
