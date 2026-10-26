"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Page } from "@/lib/shops";
import type { ProductFeedback } from "@/lib/product-feedback";
import { useShop } from "@/components/shop-provider";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  ProductReviewCard,
  FeedbackPagination,
  ReasonDialog,
  useFeedbackResource,
  type FeedbackRequest,
} from "@/components/product-reviews";
import s from "@/components/product-feedback.module.css";
export default function UserProductReviewsScreen() {
  const { user, authReady, isPreview } = useShop();
  return (
    <div className="container account-page">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "Product reviews" },
        ]}
      />
      <div className="page-title">
        <div>
          <span className="section-kicker">YOUR EXPERIENCE</span>
          <h1>My product reviews</h1>
          <p>
            Manage the feedback you have shared on your delivered purchases.
          </p>
        </div>
        <Link className="outline-btn" href="/orders">
          Review a delivered order
        </Link>
      </div>
      {!isPreview && !authReady ? (
        <p role="status">Checking your account…</p>
      ) : !isPreview && !user ? (
        <Link className="primary-btn" href="/auth?next=/account/reviews">
          Sign in to view reviews
        </Link>
      ) : !isPreview && !user?.emailVerified ? (
        <Link className="outline-btn" href="/account/security">
          Verify your email to manage reviews
        </Link>
      ) : (
        <BuyerReviews key={user?.uid ?? "preview"} />
      )}
    </div>
  );
}
function BuyerReviews() {
  const { user, isPreview } = useShop();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ProductFeedback | null>(null);
  const [notice, setNotice] = useState("");
  const request = useCallback<FeedbackRequest>(
    async (path, method = "GET", body) => {
      if (!user) throw Error("Sign in to view your reviews");
      return api(path, { method, body, token: await user.getIdToken() });
    },
    [user],
  );
  const list = useFeedbackResource<
    Page<ProductFeedback & { canViewProduct: boolean }>
  >(`/me/product-reviews?page=${page}`, request, !isPreview);
  return isPreview ? (
    <p className={s.status}>
      Connect the live API to manage your product feedback.
    </p>
  ) : (
    <>
      {notice && (
        <p role="status" className={s.status}>
          {notice}
        </p>
      )}
      <div className={s.heading}>
        <h2>Your reviews</h2>
        <button className="outline-btn" onClick={list.reload}>
          Refresh
        </button>
      </div>
      {list.loading && <p role="status">Loading your reviews…</p>}
      {list.error && (
        <div className={s.error} role="alert">
          {list.error}{" "}
          <button className="outline-btn" onClick={list.reload}>
            Retry
          </button>
        </div>
      )}
      {list.data && (
        <>
          <div className={s.list}>
            {list.data.items.map((review) => (
              <ProductReviewCard key={review.id} review={review}>
                <strong>{review.product?.title}</strong>
                {review.isHidden && (
                  <p className={s.muted}>
                    This review is hidden by moderation and cannot be
                    republished by editing.
                  </p>
                )}
                <div className={s.actions}>
                  {review.canViewProduct && (
                    <Link
                      className="outline-btn"
                      href={`/products/${review.product?.id}#product-reviews`}
                    >
                      {review.isHidden
                        ? "View product"
                        : "View product / edit review"}
                    </Link>
                  )}
                  <button
                    className="outline-btn"
                    onClick={() => setTarget(review)}
                  >
                    Delete review
                  </button>
                </div>
              </ProductReviewCard>
            ))}
            {!list.data.items.length && (
              <p className={s.status}>
                You have not shared any product reviews yet. Open a product from
                a delivered order to write one.
              </p>
            )}
          </div>
          <FeedbackPagination page={list.data} onPage={setPage} />
        </>
      )}
      {target && (
        <ReasonDialog
          title="Delete your review?"
          description={`Your feedback for ${target.product?.title} will be removed from public results. The purchase record is retained.`}
          reasonRequired={false}
          submitLabel="Delete review"
          onClose={() => setTarget(null)}
          onConfirm={async () => {
            await request(
              `/products/${target.product?.id}/customer-reviews/mine`,
              "DELETE",
              { version: target.version },
            );
            setNotice("Your review has been deleted.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
