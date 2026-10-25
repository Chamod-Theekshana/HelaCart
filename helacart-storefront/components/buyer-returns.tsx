"use client";
import { useState } from "react";
import Link from "next/link";
import { pageOf, shopDate, shopPath, type Page } from "@/lib/shops";
import { queryString, type BuyerReturn } from "@/lib/workspace";
import { ListPagination, useBuyerResource } from "./list-controls";
import s from "./list-controls.module.css";
export function BuyerReturns({ revision = 0 }: { revision?: number }) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("ALL");
  const resource = useBuyerResource<Page<BuyerReturn>>(
    `/workspace/me/returns?${queryString({ page, status })}`,
    pageOf<BuyerReturn>([], page),
    revision,
  );
  return (
    <>
      <div className="account-section-title">
        <h2>My return requests</h2>
        <span>{resource.data?.total ?? "—"} requests</span>
      </div>
      <div className={s.filters}>
        <label>
          Show{" "}
          <select
            aria-label="Filter return status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All requests</option>
            {["PENDING", "APPROVED", "REJECTED", "RESOLVED"].map((value) => (
              <option value={value} key={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button className="outline-btn" onClick={resource.reload}>
          Refresh status
        </button>
      </div>
      {resource.error && (
        <div className="message error" role="alert">
          {resource.error}
          <button className={s.retry} onClick={resource.reload}>
            Try again
          </button>
        </div>
      )}
      {resource.loading ? (
        <div className="empty-panel" role="status">
          Loading return requests…
        </div>
      ) : resource.data?.items.length ? (
        resource.data.items.map((row) => (
          <article className={`panel ${s.returnCard}`} key={row.id}>
            <header>
              <div>
                <small>RETURN #{row.id.slice(0, 8).toUpperCase()}</small>
                <h3>
                  <Link href={shopPath(row.sellerOrder.seller)}>
                    {row.sellerOrder.seller.name}
                  </Link>
                </h3>
                <small>
                  Order #{row.sellerOrder.orderId.slice(0, 8).toUpperCase()}
                </small>
              </div>
              <span className="status-pill">{row.status.toLowerCase()}</span>
            </header>
            <ul>
              {row.sellerOrder.items.map((item) => (
                <li key={item.id}>
                  {item.productTitle} · Qty {item.quantity}
                </li>
              ))}
            </ul>
            <div className={s.timeline}>
              <div>
                <strong>Request submitted</strong>
                <small>{shopDate(row.createdAt)}</small>
                <p>{row.reason}</p>
              </div>
              {row.reviewedAt && (
                <div>
                  <strong>
                    {row.status === "REJECTED"
                      ? "Request rejected"
                      : "Request approved"}
                  </strong>
                  <small>{shopDate(row.reviewedAt)}</small>
                  {row.reviewReason && <p>{row.reviewReason}</p>}
                </div>
              )}
              {row.resolvedAt && (
                <div>
                  <strong>Case resolved</strong>
                  <small>{shopDate(row.resolvedAt)}</small>
                  <p>{row.resolutionNote}</p>
                </div>
              )}
              {row.status === "PENDING" && (
                <div>
                  <strong>Awaiting review</strong>
                  <p>The HelaCart team will review your request.</p>
                </div>
              )}
              {row.status === "APPROVED" && (
                <div>
                  <strong>Awaiting completion</strong>
                  <p>
                    Your return was approved. Follow the instructions from the
                    HelaCart team.
                  </p>
                </div>
              )}
            </div>
          </article>
        ))
      ) : (
        !resource.error && (
          <div className="empty-panel">
            No return requests match this filter.
          </div>
        )
      )}
      <ListPagination
        data={resource.data}
        onPage={setPage}
        label="Your return pages"
      />
    </>
  );
}
