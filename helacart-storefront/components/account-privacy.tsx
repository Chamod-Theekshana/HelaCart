"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Download, Trash2 } from "lucide-react";
import { apiBase, ApiError, errorMessage, userApi } from "@/lib/api";
import type { NotificationPreferences } from "@/lib/types";
import { useShop } from "./shop-provider";
import { useT } from "./language-provider";

const channels = ["push", "email", "sms"] as const;

/** Notification channels (§7), PDPA data export and account deletion (§8). */
export function AccountPrivacy() {
  return (
    <div className="privacy-card">
      <NotificationSettings />
      <DataExport />
      <DeleteAccount />
    </div>
  );
}

function NotificationSettings() {
  const t = useT();
  const { user, isPreview } = useShop();
  const [state, setState] = useState<{
    uid: string;
    value: NotificationPreferences | null;
    error: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const uid = user?.uid ?? "";
  useEffect(() => {
    if (!user?.emailVerified || isPreview) return;
    let active = true;
    userApi<NotificationPreferences>(user, "/me/notification-preferences")
      .then((value) => {
        if (active) setState({ uid: user.uid, value, error: "" });
      })
      .catch((cause) => {
        if (active)
          setState({ uid: user.uid, value: null, error: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [user, isPreview]);
  const preferences = isPreview
    ? { push: true, email: true, sms: true }
    : state?.uid === uid
      ? state.value
      : null;
  async function toggle(channel: (typeof channels)[number], value: boolean) {
    if (!user || !preferences || isPreview || busy) return;
    const next = { ...preferences, [channel]: value };
    setBusy(true);
    setNotice("");
    try {
      const saved = await userApi<NotificationPreferences>(
        user,
        "/me/notification-preferences",
        { method: "PUT", body: next },
      );
      setState({ uid: user.uid, value: saved, error: "" });
      setNotice(t("privacy.notifications.saved"));
    } catch (cause) {
      setState((before) =>
        before ? { ...before, error: errorMessage(cause) } : before,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="notification-preferences">
      <h2 id="notification-preferences">
        <Bell size={17} /> {t("privacy.notifications.title")}
      </h2>
      <p>{t("privacy.notifications.text")}</p>
      {!preferences && !state?.error && (
        <p role="status">{t("common.loading")}</p>
      )}
      {state?.uid === uid && state.error && (
        <div className="message error" role="alert">
          {state.error}
        </div>
      )}
      {preferences &&
        channels.map((channel) => (
          <label className="check-row" key={channel}>
            <input
              type="checkbox"
              checked={preferences[channel]}
              disabled={busy || isPreview}
              onChange={(event) => void toggle(channel, event.target.checked)}
            />
            {t(`privacy.notifications.${channel}`)}
          </label>
        ))}
      {notice && (
        <div className="message success" role="status">
          {notice}
        </div>
      )}
    </section>
  );
}

function DataExport() {
  const t = useT();
  const { user, isPreview } = useShop();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (!user || isPreview || busy) return;
    setBusy(true);
    setError("");
    try {
      const request = async (force: boolean) =>
        fetch(`${apiBase}/me/data-export`, {
          headers: {
            Authorization: `Bearer ${await user.getIdToken(force)}`,
          },
          cache: "no-store",
        });
      let response = await request(false);
      if (response.status === 401) response = await request(true);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : t("privacy.export.error"),
        );
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const name =
        /filename="?([^";]+)"?/i.exec(disposition)?.[1] ??
        `helacart-data-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name.replace(/[^\w.-]/g, "_");
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="data-export">
      <h2 id="data-export">
        <Download size={17} /> {t("privacy.export.title")}
      </h2>
      <p>
        {t("privacy.export.text")}{" "}
        <Link href="/legal/privacy" className="text-link">
          {t("legal.privacy.title")}
        </Link>
      </p>
      <div className="inline-actions">
        <button
          className="outline-btn"
          disabled={busy || isPreview || !user?.emailVerified}
          onClick={() => void download()}
        >
          <Download size={16} />{" "}
          {busy ? t("privacy.export.busy") : t("privacy.export.button")}
        </button>
      </div>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

function DeleteAccount() {
  const t = useT();
  const router = useRouter();
  const { user, isPreview, signOutBuyer } = useShop();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!user || isPreview || busy || typed !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      await userApi(user, "/me/account", {
        method: "DELETE",
        body: { confirm: "DELETE" },
      });
      // The API deleted the Firebase user; clear the local session too.
      await signOutBuyer().catch(() => undefined);
      router.push("/?account=deleted");
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined;
      setError(
        code === "ACCOUNT_HAS_OPEN_ORDERS"
          ? t("privacy.delete.ACCOUNT_HAS_OPEN_ORDERS")
          : code === "ACCOUNT_OWNS_SHOP"
            ? t("privacy.delete.ACCOUNT_OWNS_SHOP")
            : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="danger-zone" aria-labelledby="delete-account">
      <h2 id="delete-account">
        <Trash2 size={17} /> {t("privacy.delete.title")}
      </h2>
      <p>{t("privacy.delete.text")}</p>
      <p>{t("privacy.delete.kept")}</p>
      <form onSubmit={(event) => void remove(event)} className="hc-field">
        <label htmlFor="delete-confirm">{t("privacy.delete.typeLabel")}</label>
        <input
          id="delete-confirm"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          disabled={busy || isPreview}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="DELETE"
        />
        <div className="inline-actions">
          <button
            className="danger-btn"
            type="submit"
            disabled={busy || isPreview || !user || typed !== "DELETE"}
          >
            {busy ? t("common.pleaseWait") : t("privacy.delete.button")}
          </button>
        </div>
      </form>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
