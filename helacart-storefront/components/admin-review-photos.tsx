"use client";
import { useEffect, useState } from "react";
import { apiBase, errorMessage } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import { ReviewPhotos, type ReviewPhotoSource } from "./review-photos";
import s from "./review-photos.module.css";
export function AdminReviewPhotos({
  reportId,
  photoIds,
}: {
  reportId: string;
  photoIds: string[];
}) {
  const key = photoIds.join(",");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    photos: ReviewPhotoSource[];
    error: string;
  }>({ key: "", photos: [], error: "" });
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const controller = new AbortController();
    let active = true;
    const urls: string[] = [];
    const timer = setTimeout(() => controller.abort(), 30000);
    const load = async () => {
      try {
        const user = clientAuth()?.currentUser;
        if (!user)
          throw new Error(
            "Sign in as an administrator to view reported photos.",
          );
        const token = await user.getIdToken();
        const results = await Promise.allSettled(
          ids.map(async (id) => {
            const response = await fetch(
              `${apiBase}/admin/shop-review-reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(id)}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
                cache: "no-store",
                credentials: "omit",
              },
            );
            if (!response.ok)
              throw new Error("Could not load a reported photo.");
            const blob = await response.blob();
            if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
              throw new Error("Unsupported photo type.");
            if (!active) return null;
            const src = URL.createObjectURL(blob);
            urls.push(src);
            return { id, src };
          }),
        );
        if (active)
          setState({
            key,
            photos: results.flatMap((result) =>
              result.status === "fulfilled" && result.value
                ? [result.value]
                : [],
            ),
            error: results.some((result) => result.status === "rejected")
              ? "Some reported photos could not be loaded."
              : "",
          });
      } catch (error) {
        if (active) setState({ key, photos: [], error: errorMessage(error) });
      } finally {
        clearTimeout(timer);
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [reportId, key, attempt]);
  if (!photoIds.length) return null;
  return (
    <section aria-label="Reported review photos">
      <strong>Photos at the time of report</strong>
      {state.key === key ? (
        <>
          <ReviewPhotos photos={state.photos} label="Reported review photos" />
          {state.error && (
            <p className={s.adminError} role="alert">
              {state.error}{" "}
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Retry photos
              </button>
            </p>
          )}
        </>
      ) : (
        <p>Loading reported photos…</p>
      )}
    </section>
  );
}
