"use client";
import { useState } from "react";
import Link from "next/link";
import type { Page } from "@/lib/shops";
import type { ProductFeedback } from "@/lib/product-feedback";
import { errorMessage } from "@/lib/api";
import { useSeller } from "@/components/seller-provider";
import {
  ProductReviewCard,
  FeedbackPagination,
  useFeedbackResource,
} from "@/components/product-reviews";
import s from "@/components/product-feedback.module.css";
export default function SellerProductReviews() {
  const { seller, profile } = useSeller();
  return <SellerProductReviewsContent key={`${seller?.id}:${profile?.id}`} />;
}
function SellerProductReviewsContent() {
  const { seller, request, isPreview } = useSeller();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState("");
  const list = useFeedbackResource<Page<ProductFeedback>>(
    `/sellers/${seller?.id}/product-reviews?page=${page}${rating ? `&rating=${rating}` : ""}`,
    request,
    !!seller && !isPreview,
  );
  return (
    <>
      <span className="section-kicker">BUYER FEEDBACK</span>
      <h1>Product reviews</h1>
      <p className={s.muted}>
        Read verified product feedback and reply publicly.{" "}
        <Link href="/seller/reviews">Shop reviews</Link> are separate.
      </p>
      {isPreview ? (
        <p className={s.status}>
          Connect the API to view real product reviews.
        </p>
      ) : (
        <>
          <div className={s.filters}>
            <label>
              Rating
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
            <button className="outline-btn" onClick={list.reload}>
              Refresh
            </button>
          </div>
          {list.loading && <p role="status">Loading product reviews…</p>}
          {list.error && (
            <div role="alert" className={s.error}>
              {list.error}
              <button className="outline-btn" onClick={list.reload}>
                Retry
              </button>
            </div>
          )}
          {list.data && (
            <>
              <div className={s.list}>
                {list.data.items.map((review) => (
                  <ProductReviewCard
                    review={review}
                    key={`${review.id}:${review.version}`}
                  >
                    <p>
                      <Link
                        className="text-link"
                        href={`/seller/products/${review.product?.id}`}
                      >
                        {review.product?.title}
                      </Link>
                    </p>
                    {!review.isHidden && seller?.status === "APPROVED" && (
                      <ReplyForm
                        review={review}
                        path={`/sellers/${seller.id}/product-reviews/${review.id}/reply`}
                        request={request}
                        onSaved={list.reload}
                      />
                    )}
                  </ProductReviewCard>
                ))}
                {!list.data.items.length && (
                  <p className={s.status}>
                    No product reviews match these filters.
                  </p>
                )}
              </div>
              <FeedbackPagination page={list.data} onPage={setPage} />
            </>
          )}
        </>
      )}
    </>
  );
}
function ReplyForm({
  review,
  path,
  request,
  onSaved,
}: {
  review: ProductFeedback;
  path: string;
  request: ReturnType<typeof useSeller>["request"];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(review.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return open ? (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await request(path, "PUT", {
            version: review.version,
            reply: reply.trim(),
          });
          setOpen(false);
          onSaved();
        } catch (error) {
          setError(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Public seller response
        <textarea
          maxLength={1500}
          rows={4}
          value={reply}
          disabled={busy}
          onChange={(e) => setReply(e.target.value)}
        />
      </label>
      <small className={s.muted}>
        Saving an empty response removes your existing reply.
      </small>
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
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button className="primary-btn" disabled={busy}>
          {busy ? "Saving…" : "Save reply"}
        </button>
      </div>
    </form>
  ) : (
    <button className="outline-btn" onClick={() => setOpen(true)}>
      {review.reply ? "Edit reply" : "Reply to review"}
    </button>
  );
}
