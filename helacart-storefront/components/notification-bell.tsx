"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { notificationHref } from "@/lib/notifications";
import { useShop } from "./shop-provider";
import styles from "./notification-bell.module.css";
type Inbox = { items: Notification[]; unreadCount: number };
export function NotificationBell(props: {
  workspace?: "buyer" | "seller" | "admin";
}) {
  const { user } = useShop();
  return <NotificationInbox key={user?.uid ?? "preview"} {...props} />;
}
function NotificationInbox({
  workspace = "buyer",
}: {
  workspace?: "buyer" | "seller" | "admin";
}) {
  const { user, isPreview } = useShop(),
    uid = user?.uid;
  const box = useRef<HTMLDetailsElement>(null),
    latestUid = useRef(uid),
    sequence = useRef(0);
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [state, setState] = useState<{
      uid: string;
      data: Inbox | null;
      error: string;
    } | null>(null);
  useEffect(() => {
    latestUid.current = uid;
  }, [uid]);
  useEffect(() => {
    if (!user || isPreview) return;
    let active = true;
    async function load() {
      if (document.visibilityState === "hidden") return;
      const request = ++sequence.current;
      try {
        const data = await api<Inbox>("/me/notifications/inbox", {
          token: await user!.getIdToken(),
        });
        if (active && sequence.current === request)
          setState({ uid: user!.uid, data, error: "" });
      } catch (cause) {
        if (active && sequence.current === request)
          setState((old) => ({
            uid: user!.uid,
            data: old?.uid === user!.uid ? old.data : null,
            error: errorMessage(cause),
          }));
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [user, isPreview, revision]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && box.current)
        box.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && box.current) {
        box.current.open = false;
        box.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  if (!user && !isPreview) return null;
  const current = state?.uid === uid ? state : null,
    data = isPreview ? { items: [], unreadCount: 0 } : current?.data;
  const target = (notice: Notification) => notificationHref(notice, workspace);
  async function read(id?: string) {
    if (!user || isPreview || busy) return;
    const identity = user.uid;
    setBusy(true);
    try {
      await api(
        id ? `/me/notifications/${id}/read` : "/me/notifications/read-all",
        { method: "PATCH", token: await user.getIdToken() },
      );
      if (latestUid.current === identity) setRevision((v) => v + 1);
    } catch (cause) {
      if (latestUid.current === identity)
        setState((old) => ({
          uid: identity,
          data: old?.uid === identity ? old.data : null,
          error: errorMessage(cause),
        }));
    } finally {
      if (latestUid.current === identity) setBusy(false);
    }
  }
  return (
    <details className={styles.bell} ref={box}>
      <summary
        aria-label={`Notifications${data?.unreadCount ? `, ${data.unreadCount} unread` : ""}`}
      >
        <Bell size={20} />
        {Boolean(data?.unreadCount) && (
          <span className={styles.count}>
            {data!.unreadCount > 99 ? "99+" : data!.unreadCount}
          </span>
        )}
      </summary>
      <div className={styles.panel}>
        <div className={styles.heading}>
          <strong>Notifications</strong>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => {
              if (box.current) box.current.open = false;
            }}
          >
            <X size={17} />
          </button>
        </div>
        {isPreview ? (
          <p className={styles.muted}>
            Design preview. Live order updates appear here after sign in.
          </p>
        ) : (
          <>
            <div className={styles.actions}>
              <button
                disabled={busy || !data?.unreadCount}
                onClick={() => void read()}
              >
                Mark all read
              </button>
              <button onClick={() => setRevision((v) => v + 1)}>Refresh</button>
            </div>
            {current?.error && (
              <p role="alert" className={styles.error}>
                {current.error}
              </p>
            )}
            {!data && !current?.error ? (
              <p>Loading updates…</p>
            ) : data?.items.length ? (
              data.items.map((notice) => (
                <Link
                  key={notice.id}
                  href={target(notice)}
                  className={`${styles.item} ${!notice.readAt ? styles.unread : ""}`}
                  onClick={() => {
                    if (!notice.readAt) void read(notice.id);
                    if (box.current) box.current.open = false;
                  }}
                >
                  <span>{notice.message}</span>
                  <small>
                    {new Intl.DateTimeFormat("en-LK", {
                      timeZone: "Asia/Colombo",
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(notice.createdAt))}
                  </small>
                </Link>
              ))
            ) : !current?.error ? (
              <p className={styles.muted}>No notifications yet.</p>
            ) : null}
            <Link
              className={styles.footer}
              href="/account?tab=notifications"
              onClick={() => {
                if (box.current) box.current.open = false;
              }}
            >
              View all notifications
            </Link>
          </>
        )}
      </div>
    </details>
  );
}
