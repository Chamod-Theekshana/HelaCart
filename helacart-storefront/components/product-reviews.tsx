"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type {
  FeedbackAccess,
  FeedbackPage,
  ProductFeedback,
} from "@/lib/product-feedback";
import { formatSellerDate } from "@/lib/seller";
import { useShop } from "./shop-provider";
import s from "./product-feedback.module.css";
export type FeedbackRequest = <T>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
export function useFeedbackResource<T>(
  path: string,
  request: FeedbackRequest,
  enabled = true,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const key = `${path}:${revision}`;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    request<T>(path)
      .then((data) => {
        if (active) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setState({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [request, path, key, enabled]);
  return {
    data: enabled && state.key === key ? state.data : null,
    error: enabled && state.key === key ? state.error : "",
    loading: enabled && state.key !== key,
    reload: () => setRevision((r) => r + 1),
  };
}
export function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className={s.stars} aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}
export function ProductReviewCard({
  review,
  children,
}: {
  review: ProductFeedback;
  children?: React.ReactNode;
}) {
  return (
    <article className={s.review}>
      <div className={s.heading}>
        <strong>{review.buyerName}</strong>
        <ReviewStars rating={review.rating} />
      </div>
      <div className={s.meta}>
        <span className={s.badge}>
          <BadgeCheck size={13} />
          Verified purchase
        </span>
        <span>{formatSellerDate(review.createdAt)}</span>
        {review.variantLabel && <span>{review.variantLabel}</span>}
        {review.isHidden && <span>Hidden by moderation</span>}
      </div>
      <p>{review.comment}</p>
      {review.reply && (
        <div className={s.reply}>
          <strong>Seller response</strong>
          <p>{review.reply}</p>
          {review.repliedAt && (
            <small>{formatSellerDate(review.repliedAt)}</small>
          )}
        </div>
      )}
      {children}
    </article>
  );
}
export function ReasonDialog({
  title,
  description,
  submitLabel,
  onConfirm,
  onClose,
  reasonRequired = true,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  reasonRequired?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="feedback-dialog-title"
    >
      <h2 id="feedback-dialog-title">{title}</h2>
      <p className={s.detailsText}>{description}</p>
      <form onSubmit={(e) => void submit(e)}>
        {reasonRequired && (
          <label>
            Reason
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={4}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <div className={s.actions}>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
const publicRequest: FeedbackRequest = (path) => api(path);
export function ProductReviews({ productId }: { productId: string }) {
  const { user, isPreview } = useShop();
  return (
    <ProductReviewsContent
      key={`${productId}:${user?.uid}:${user?.emailVerified}`}
      productId={productId}
      isPreview={isPreview}
    />
  );
}
function ProductReviewsContent({
  productId,
  isPreview,
}: {
  productId: string;
  isPreview: boolean;
}) {
  const { user } = useShop();
  const [sort, setSort] = useState("newest");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<{
    type: "REPORT" | "DELETE";
    review: ProductFeedback;
  } | null>(null);
  const request = useCallback<FeedbackRequest>(
    async (path, method = "GET", body) => {
      if (!user) throw Error("Sign in to manage reviews");
      return api(path, { method, body, token: await user.getIdToken() });
    },
    [user],
  );
  const base = `/products/${productId}/customer-reviews`;
  const list = useFeedbackResource<FeedbackPage>(
    `${base}?page=${page}&sort=${sort}${rating ? `&rating=${rating}` : ""}`,
    publicRequest,
    !isPreview,
  );
  const access = useFeedbackResource<FeedbackAccess>(
    `${base}/access`,
    request,
    !isPreview && Boolean(user?.emailVerified),
  );
  const [success, setSuccess] = useState("");
  function refresh() {
    list.reload();
    access.reload();
  }
  return (
    <section id="product-reviews" className={s.section}>
      <div className={s.heading}>
        <div>
          <span className="section-kicker">FROM VERIFIED BUYERS</span>
          <h2>Product reviews</h2>
        </div>
        {access.data?.eligible && !editing && (
          <button
            className="outline-btn"
            onClick={() => {
              setEditing(true);
              setSuccess("");
            }}
          >
            {access.data.review && !access.data.review.deletedAt
              ? "Edit your review"
              : "Write a review"}
          </button>
        )}
      </div>
      {isPreview ? (
        <p className={s.status}>
          Product reviews appear here when the live API is connected. Preview
          products have no buyer ratings.
        </p>
      ) : (
        <>
          {list.data && (
            <div className={s.summary}>
              <div>
                <strong className={s.average}>
                  {list.data.summary.total
                    ? list.data.summary.average.toFixed(1)
                    : "—"}
                </strong>
                <span>
                  {list.data.summary.total}{" "}
                  {list.data.summary.total === 1 ? "review" : "reviews"}
                </span>
                <p className={s.muted}>Ratings for this product</p>
              </div>
              <div>
                {list.data.summary.breakdown.map((row) => (
                  <div className={s.bar} key={row.rating}>
                    <span>{row.rating} ★</span>
                    <progress
                      value={row.count}
                      max={Math.max(1, list.data!.summary.total)}
                      aria-label={`${row.rating} stars: ${row.count} reviews`}
                    />
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!user ? (
            <p className={s.status}>
              <Link
                href={`/auth?next=${encodeURIComponent(`/products/${productId}`)}`}
              >
                Sign in
              </Link>{" "}
              to review a delivered purchase.
            </p>
          ) : !user.emailVerified ? (
            <p className={s.status}>
              <Link href="/account/security">Verify your email</Link> to write
              or report product reviews.
            </p>
          ) : access.loading ? (
            <p role="status">Checking review eligibility…</p>
          ) : access.error ? (
            <div className={s.error} role="alert">
              {access.error}{" "}
              <button className="outline-btn" onClick={() => access.reload()}>
                Retry eligibility
              </button>
            </div>
          ) : !access.data?.eligible ? (
            <p className={s.status}>{access.data?.reason}</p>
          ) : null}
          {success && (
            <p className={s.status} role="status">
              {success}
            </p>
          )}
          {editing && access.data?.eligible && (
            <ReviewForm
              review={access.data.review}
              request={request}
              path={`${base}/mine`}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setSuccess("Your product review has been saved.");
                refresh();
              }}
            />
          )}
          {access.data?.review && !access.data.review.deletedAt && !editing && (
            <div className={s.form}>
              <div className={s.heading}>
                <h3>Your review</h3>
                <ReviewStars rating={access.data.review.rating} />
              </div>
              <p className={s.detailsText}>{access.data.review.comment}</p>
              <div className={s.actions}>
                {access.data.eligible && (
                  <button
                    className="outline-btn"
                    onClick={() => setEditing(true)}
                  >
                    Edit review
                  </button>
                )}
                <button
                  className="outline-btn"
                  onClick={() =>
                    setTarget({ type: "DELETE", review: access.data!.review! })
                  }
                >
                  Delete review
                </button>
              </div>
            </div>
          )}
          <div className={s.filters}>
            <label>
              Stars
              <select
                value={rating}
                onChange={(e) => {
                  setRating(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort reviews
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </label>
            <button
              className="outline-btn"
              onClick={refresh}
              disabled={editing}
            >
              Refresh
            </button>
          </div>
          {list.loading && <p role="status">Loading product reviews…</p>}
          {list.error && (
            <div className={s.error} role="alert">
              {list.error}{" "}
              <button className="outline-btn" onClick={() => list.reload()}>
                Retry
              </button>
            </div>
          )}
          {list.data && (
            <>
              <div className={s.list}>
                {list.data.items.length ? (
                  list.data.items.map((review) => (
                    <ProductReviewCard key={review.id} review={review}>
                      {user?.emailVerified &&
                        review.id !== access.data?.review?.id && (
                          <div className={s.actions}>
                            <button
                              className="outline-btn"
                              onClick={() =>
                                setTarget({ type: "REPORT", review })
                              }
                            >
                              Report review
                            </button>
                          </div>
                        )}
                    </ProductReviewCard>
                  ))
                ) : (
                  <p className={s.status}>
                    {rating
                      ? "No reviews match this rating."
                      : "No reviews yet. Buyers can share feedback after delivery."}
                  </p>
                )}
              </div>
              <FeedbackPagination page={list.data} onPage={setPage} />
            </>
          )}
        </>
      )}
      {target && (
        <ReasonDialog
          key={`${target.type}:${target.review.id}`}
          title={
            target.type === "DELETE"
              ? "Delete your review?"
              : "Report product review"
          }
          description={
            target.type === "DELETE"
              ? "Your review and rating will be removed from public results. You can write it again later."
              : `Report feedback by ${target.review.buyerName}. HelaCart will review your reason privately.`
          }
          reasonRequired={target.type === "REPORT"}
          submitLabel={
            target.type === "DELETE" ? "Delete review" : "Submit report"
          }
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            if (target.type === "DELETE") {
              await request(`${base}/mine`, "DELETE", {
                version: target.review.version,
              });
              setSuccess("Your review has been deleted.");
              refresh();
            } else {
              await request(`${base}/${target.review.id}/reports`, "POST", {
                reason,
              });
              setSuccess("Your report has been sent to HelaCart for review.");
            }
          }}
        />
      )}
    </section>
  );
}
function ReviewForm({
  review,
  request,
  path,
  onSaved,
  onClose,
}: {
  review: FeedbackAccess["review"];
  request: FeedbackRequest;
  path: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [comment, setComment] = useState(
    review && !review.deletedAt ? review.comment : "",
  );
  const [version] = useState(review?.version ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(path, "PUT", { rating, comment: comment.trim(), version });
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.form} onSubmit={(e) => void submit(e)}>
      <h3>
        {review && !review.deletedAt
          ? "Edit your review"
          : "Share your experience"}
      </h3>
      <fieldset className={s.starPicker} disabled={busy}>
        <legend>Your rating</legend>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={rating === n}
              aria-label={`${n} stars`}
              onClick={() => setRating(n)}
            >
              <Star size={21} fill={n <= rating ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Your review
        <textarea
          required
          minLength={10}
          maxLength={1500}
          rows={5}
          disabled={busy}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What was the item like? Share useful details about quality, fit or use."
        />
      </label>
      <small className={s.muted}>
        {comment.length}/1500 · One review per buyer for this product
      </small>
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      <div className={s.actions}>
        <button
          className="outline-btn"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save review"}
        </button>
      </div>
    </form>
  );
}
export function FeedbackPagination({
  page,
  onPage,
}: {
  page: { page: number; pages: number; total: number };
  onPage: (page: number) => void;
}) {
  return page.pages > 1 ? (
    <div className={s.pagination}>
      <button
        className="outline-btn"
        disabled={page.page <= 1}
        onClick={() => onPage(page.page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page.page} of {page.pages}
      </span>
      <button
        className="outline-btn"
        disabled={page.page >= page.pages}
        onClick={() => onPage(page.page + 1)}
      >
        Next
      </button>
    </div>
  ) : null;
}
