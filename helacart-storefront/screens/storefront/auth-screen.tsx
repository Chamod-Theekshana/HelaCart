"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { errorMessage } from "@/lib/api";
import { clientAuth, hasFirebase } from "@/lib/firebase";
import { useShop } from "@/components/shop-provider";
import { safeSignInDestination } from "@/lib/favorites";
import { useT } from "@/components/language-provider";

export default function AuthPage() {
  const t = useT();
  const router = useRouter();
  const { user, refreshCart } = useShop();
  const destination = () =>
    safeSignInDestination(
      new URLSearchParams(window.location.search).get("next"),
    );
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
    setBusy(true);
    setNotice("");
    setError("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setNotice(t("auth.resetSent"));
      } else if (mode === "register") {
        const created = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await sendEmailVerification(created.user);
        setNotice(t("auth.created"));
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push(destination());
      }
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }
  async function checkVerification() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await reload(user);
      if (user.emailVerified) {
        // Force one token refresh right after verification so the API sees it.
        await user.getIdToken(true);
        await refreshCart();
      }
      setNotice(
        user.emailVerified ? t("auth.verifiedNow") : t("auth.stillWaiting"),
      );
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card">
          <span className="auth-emblem">
            <ShieldCheck size={23} />
          </span>
          <span className="section-kicker">{t("auth.kicker")}</span>
          <h1>{mode === "reset" ? t("auth.resetTitle") : t("auth.welcome")}</h1>
          <p>{t("auth.subtitle")}</p>
          {user && (
            <div className="message success">
              {t("auth.signedInAs", { email: user.email ?? "" })}{" "}
              {user.emailVerified
                ? t("auth.isVerified")
                : t("auth.pleaseVerify")}
              {!user.emailVerified && (
                <button
                  className="inline-action"
                  disabled={busy}
                  onClick={checkVerification}
                >
                  {t("auth.iVerified")}
                </button>
              )}
              <button
                className="inline-action"
                disabled={busy}
                onClick={() => router.push(destination())}
              >
                {t("auth.continue")}
              </button>
            </div>
          )}
          {mode !== "reset" && (
            <div className="auth-tabs">
              <button
                className={mode === "sign-in" ? "active" : ""}
                onClick={() => {
                  setMode("sign-in");
                  setError("");
                }}
              >
                {t("auth.tabSignIn")}
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                {t("auth.tabRegister")}
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              {t("auth.email")}
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </label>
            {mode !== "reset" && (
              <label>
                {t("auth.password")}
                <div className="input-with-icon">
                  <LockKeyhole size={18} />
                  <input
                    type="password"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    minLength={6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("auth.passwordHint")}
                  />
                </div>
              </label>
            )}
            {mode === "sign-in" && (
              <button
                className="forgot-link"
                type="button"
                onClick={() => setMode("reset")}
              >
                {t("auth.forgot")}
              </button>
            )}
            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="message success" role="status">
                {notice}
              </div>
            )}
            {!hasFirebase && (
              <div className="message info">{t("auth.notConfigured")}</div>
            )}
            <button
              className="primary-btn auth-submit"
              type="submit"
              disabled={busy || !hasFirebase}
            >
              {busy
                ? t("common.pleaseWait")
                : mode === "reset"
                  ? t("auth.sendReset")
                  : mode === "register"
                    ? t("auth.tabRegister")
                    : t("auth.submitSignIn")}{" "}
              <ArrowRight size={17} />
            </button>
            {mode === "register" && (
              <p className="auth-legal">
                {t("auth.legal.prefix")}{" "}
                <Link href="/legal/terms">{t("legal.terms.title")}</Link>
                {t("auth.legal.and")}
                <Link href="/legal/privacy">{t("legal.privacy.title")}</Link>
                {t("auth.legal.suffix")}
              </p>
            )}
          </form>
          {mode === "reset" && (
            <button
              className="text-link auth-return"
              onClick={() => setMode("sign-in")}
            >
              {t("auth.backToSignIn")}
            </button>
          )}
          <div className="auth-card-bottom">
            <span>
              <Banknote size={19} /> {t("trust.cod.title")}
            </span>
            <span>
              <Truck size={19} /> {t("auth.marketplace")}
            </span>
          </div>
        </div>
        <div className="auth-support">
          <div>
            <ShieldCheck size={24} />
            <strong>{t("auth.support.local.title")}</strong>
            <p>{t("auth.support.local.text")}</p>
          </div>
          <div>
            <Banknote size={24} />
            <strong>{t("trust.cod.text")}</strong>
            <p>{t("auth.support.cod.text")}</p>
          </div>
          <div>
            <Truck size={24} />
            <strong>{t("auth.support.orders.title")}</strong>
            <p>{t("auth.support.orders.text")}</p>
          </div>
        </div>
        <p className="auth-disclaimer">
          <Link href="/products">{t("auth.browseWithout")}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/legal/privacy">{t("legal.privacy.title")}</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/legal/terms">{t("legal.terms.title")}</Link>
        </p>
      </div>
    </div>
  );
}
