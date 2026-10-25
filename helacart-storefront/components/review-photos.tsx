"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { apiBase } from "@/lib/api";
import s from "./review-photos.module.css";
export const reviewPhotoUrl = (slug: string, reviewId: string, id: string) =>
  `${apiBase}/shops/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/photos/${encodeURIComponent(id)}`;
export type ReviewPhotoSource = { id: string; src: string };
function Photo({
  src,
  alt,
  large = false,
}: {
  src: string;
  alt: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className={s.unavailable}>
      <ImageOff size={22} />
      <span>Photo unavailable</span>
    </span>
  ) : (
    <img
      src={src}
      alt={alt}
      loading={large ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
export function ReviewPhotos({
  photos,
  label = "Customer review photos",
}: {
  photos: ReviewPhotoSource[];
  label?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = selected !== null;
  useEffect(() => {
    if (!isOpen) return;
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
  if (!photos.length) return null;
  return (
    <>
      <div className={s.gallery} aria-label={label}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`View review photo ${index + 1}`}
          >
            <Photo src={photo.src} alt={`Customer photo ${index + 1}`} />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-label={label}
        onClose={() => setSelected(null)}
        onCancel={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && selected !== null) {
            event.preventDefault();
            setSelected((selected + 1) % photos.length);
          }
          if (event.key === "ArrowLeft" && selected !== null) {
            event.preventDefault();
            setSelected((selected + photos.length - 1) % photos.length);
          }
        }}
      >
        {selected !== null && photos[selected] && (
          <>
            <header>
              <span>
                Customer photo {selected + 1} of {photos.length}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close review photo"
              >
                <X size={21} />
              </button>
            </header>
            <div className={s.fullImage}>
              <Photo
                key={photos[selected].id}
                src={photos[selected].src}
                alt={`Customer review photo ${selected + 1}`}
                large
              />
            </div>
            {photos.length > 1 && (
              <footer>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((selected + photos.length - 1) % photos.length)
                  }
                  aria-label="Previous review photo"
                >
                  <ChevronLeft size={20} />
                </button>
                <span>
                  {selected + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected((selected + 1) % photos.length)}
                  aria-label="Next review photo"
                >
                  <ChevronRight size={20} />
                </button>
              </footer>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
