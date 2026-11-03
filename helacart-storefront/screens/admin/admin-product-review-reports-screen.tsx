"use client";
import { useState } from "react";
import type { Page } from "@/lib/shops";
import type { ProductFeedbackReport } from "@/lib/product-feedback";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import {
  FeedbackPagination,
  ProductReviewCard,
  ReasonDialog,
  useFeedbackResource,
  ReviewStars,
} from "@/components/product-reviews";
import s from "@/components/product-feedback.module.css";
export default function AdminProductReviewReports() {
  const { user } = useShop();
  return <Reports key={user?.uid} />;
}
function Reports() {
  const { request, isPreview } = useAdmin();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("OPEN");
  const [target, setTarget] = useState<{
    report: ProductFeedbackReport;
    action: "HIDE" | "DISMISS";
  } | null>(null);
  const list = useFeedbackResource<Page<ProductFeedbackReport>>(
    `/admin/product-review-reports?page=${page}&status=${status}`,
    request,
    !isPreview,
  );
  return (
    <>
      <span className="section-kicker">MODERATION</span>
      <h1>Product review reports</h1>
      <p className={s.muted}>
        Review the reported snapshot and current feedback before recording a
        decision. Hiding a review also removes its rating from the product
        summary.
      </p>
      {isPreview ? (
        <p className={s.status}>
          Connect the API and sign in as an administrator to review real
          reports.
        </p>
      ) : (
        <>
          <div className={s.filters}>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {["OPEN", "ACTIONED", "DISMISSED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button className="outline-btn" onClick={list.reload}>
              Refresh
            </button>
          </div>
          {list.loading && <p role="status">Loading reported reviews…</p>}
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
                {list.data.items.map((report) => (
                  <article className={s.section} key={report.id}>
                    <h2>{report.review.product.title}</h2>
                    <p>
                      {report.review.product.seller.name} · {report.status}
                    </p>
                    <div className={s.status}>
                      <strong>Reason for report</strong>
                      <p className={s.detailsText}>{report.reason}</p>
                      <strong>Reported snapshot</strong>
                      <p>
                        <ReviewStars rating={report.ratingSnapshot} />
                      </p>
                      <p className={s.detailsText}>{report.commentSnapshot}</p>
                    </div>
                    <h3>Current review</h3>
                    {report.review.deletedAt && (
                      <p className={s.status}>
                        Buyer deleted this review; it is already excluded from
                        public results.
                      </p>
                    )}
                    <ProductReviewCard review={report.review} />
                    {report.note && (
                      <p className={s.detailsText}>
                        <strong>Moderation note: </strong>
                        {report.note}
                      </p>
                    )}
                    {report.status === "OPEN" && (
                      <div className={s.actions}>
                        <button
                          className="outline-btn"
                          onClick={() =>
                            setTarget({ report, action: "DISMISS" })
                          }
                        >
                          Dismiss report
                        </button>
                        <button
                          className="primary-btn"
                          onClick={() => setTarget({ report, action: "HIDE" })}
                        >
                          Hide review
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {!list.data.items.length && (
                  <p className={s.status}>No reports in this status.</p>
                )}
              </div>
              <FeedbackPagination page={list.data} onPage={setPage} />
            </>
          )}
        </>
      )}
      {target && (
        <ReasonDialog
          title={
            target.action === "HIDE" ? "Hide product review" : "Dismiss report"
          }
          description={`${target.report.review.product.title} · ${target.report.review.buyerName}. The decision and reason will be retained in the moderation history.`}
          submitLabel={
            target.action === "HIDE" ? "Hide review" : "Dismiss report"
          }
          onClose={() => setTarget(null)}
          onConfirm={async (note) => {
            await request(
              `/admin/product-review-reports/${target.report.id}`,
              "PATCH",
              { action: target.action, note },
            );
            list.reload();
          }}
        />
      )}
    </>
  );
}
