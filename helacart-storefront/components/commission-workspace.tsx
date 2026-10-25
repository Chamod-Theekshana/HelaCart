"use client";
/* eslint-disable @next/next/no-img-element */
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Download,
  FileCheck2,
  Receipt,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { apiBase, errorMessage, money } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import { useShop } from "./shop-provider";
import { dateTime, shortId } from "@/lib/admin";
import { rupeesToMinor } from "@/lib/seller";
import { AdminBadge } from "./admin-ui";
import { ListPagination } from "./list-controls";
import type { Page } from "@/lib/shops";
import {
  currentMonth,
  emptyPage,
  localToday,
  previewBalance,
  previewCharges,
  previewPayments,
  previewPolicy,
  previewStatement,
  rateLabel,
  type CommissionBalance,
  type CommissionCharge,
  type CommissionPayment,
  type CommissionPolicy,
  type CommissionStatement,
  type FinanceRequest,
} from "@/lib/commission";
import styles from "./commission-workspace.module.css";
import {
  CommissionCorrectionDialog,
  type CommissionCorrectionTarget,
} from "./commission-correction-dialog";
import { CommissionHoldDialog } from "./commission-hold-dialog";

export function useFinanceResource<T>(
  path: string,
  sample: T,
  request: FinanceRequest,
  isPreview: boolean,
  revision = 0,
) {
  const { user } = useShop();
  const key = `${user?.uid}:${path}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  useEffect(() => {
    if (isPreview || !path) return;
    let active = true;
    request<T>(path)
      .then((data) => {
        if (active) setState({ key, data, error: "" });
      })
      .catch((cause) => {
        if (active) setState({ key, data: null, error: errorMessage(cause) });
      });
    return () => {
      active = false;
    };
  }, [key, path, request, isPreview]);
  return {
    data: isPreview ? sample : state.key === key ? state.data : null,
    error: !isPreview && state.key === key ? state.error : "",
    loading: !isPreview && Boolean(path) && state.key !== key,
  };
}
export function FinanceFeedback({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  return (
    <>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="message info" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
export function FinanceCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function FinanceMetrics({
  items,
}: {
  items: {
    label: string;
    value: number | undefined;
    detail?: string;
    warn?: boolean;
  }[];
}) {
  return (
    <div className={styles.metrics}>
      {items.map((item) => (
        <div
          className={`${styles.metric} ${item.warn ? styles.warning : ""}`}
          key={item.label}
        >
          <small>{item.label}</small>
          <strong>{item.value == null ? "—" : money(item.value)}</strong>
          {item.detail && <span>{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
export function FinanceTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: string;
}) {
  return empty ? (
    <p className={styles.empty}>{empty}</p>
  ) : (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function FinancePager<T>({
  data,
  onPage,
  loading,
}: {
  data: Page<T> | null;
  onPage: (page: number) => void;
  loading: boolean;
}) {
  return (
    <ListPagination
      data={data}
      onPage={onPage}
      loading={loading}
      label="Commission records"
    />
  );
}
async function privateFile(path: string) {
  const user = clientAuth()?.currentUser;
  if (!user) throw Error("Sign in again to continue");
  const uid = user.uid;
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken(true)}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw Error(body?.message || "Could not download this file");
  }
  const blob = await response.blob();
  if (clientAuth()?.currentUser?.uid !== uid)
    throw Error("Account changed. Open the file again");
  return blob;
}
export function ReceiptViewer({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState({ url: "", error: "" });
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true,
      url = "";
    privateFile(path)
      .then((blob) => {
        if (!active) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type))
          throw Error("Receipt image format unavailable");
        url = URL.createObjectURL(blob);
        setState({ url, error: "" });
      })
      .catch((cause) => {
        if (active) setState({ url: "", error: errorMessage(cause) });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return (
    <dialog ref={dialog} className={styles.dialog} onCancel={onClose}>
      <div className={styles.cardHead}>
        <h2>Payment receipt</h2>
        <button
          className="outline-btn"
          onClick={onClose}
          aria-label="Close receipt"
        >
          <X size={18} />
        </button>
      </div>
      {state.error ? (
        <p role="alert">{state.error}</p>
      ) : state.url ? (
        <img
          className={styles.receiptImage}
          src={state.url}
          alt="Seller's submitted bank payment receipt"
        />
      ) : (
        <p>Loading receipt…</p>
      )}
      <p className={styles.muted}>
        This receipt is private to your shop and HelaCart. Payment status
        changes after owner verification.
      </p>
    </dialog>
  );
}

export function CommissionAccount({
  sellerId,
  request,
  isPreview,
  admin = false,
}: {
  sellerId: string;
  request: FinanceRequest;
  isPreview: boolean;
  admin?: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("charges");
  const [chargePage, setChargePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [statementPage, setStatementPage] = useState(1);
  const [month, setMonth] = useState(currentMonth);
  const [receiptId, setReceiptId] = useState("");
  const [refund, setRefund] = useState<CommissionCharge | null>(null);
  const [hold, setHold] = useState<CommissionCharge | null>(null);
  const [correction, setCorrection] =
    useState<CommissionCorrectionTarget | null>(null);
  const [message, setMessage] = useState({ error: "", notice: "" });
  const [exporting, setExporting] = useState(false);
  const root = admin
    ? `/admin/commission/sellers/${sellerId}`
    : `/sellers/${sellerId}/commission`;
  const summary = useFinanceResource<CommissionBalance>(
    `${root}/summary`,
    previewBalance,
    request,
    isPreview,
    revision,
  );
  const policy = useFinanceResource<CommissionPolicy>(
    admin ? "/admin/commission/policy" : `${root}/policy`,
    previewPolicy,
    request,
    isPreview,
    revision,
  );
  const charges = useFinanceResource<Page<CommissionCharge>>(
    tab === "charges" ? `${root}/charges?page=${chargePage}` : "",
    emptyPage(previewCharges),
    request,
    isPreview,
    revision,
  );
  const payments = useFinanceResource<Page<CommissionPayment>>(
    tab === "payments"
      ? admin
        ? `/admin/commission/payments?sellerId=${sellerId}&page=${paymentPage}`
        : `${root}/payments?page=${paymentPage}`
      : "",
    emptyPage(previewPayments),
    request,
    isPreview,
    revision,
  );
  const statement = useFinanceResource<CommissionStatement>(
    tab === "statement"
      ? `${root}/statement?month=${month}&page=${statementPage}`
      : "",
    previewStatement,
    request,
    isPreview,
    revision,
  );
  function refresh() {
    setRevision((v) => v + 1);
  }
  async function exportStatement() {
    if (isPreview || exporting) return;
    setExporting(true);
    setMessage({ error: "", notice: "" });
    let url = "";
    try {
      const blob = await privateFile(`${root}/statement.csv?month=${month}`);
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `helacart-commission-${month}.csv`;
      a.click();
    } catch (cause) {
      setMessage({ error: errorMessage(cause), notice: "" });
    } finally {
      if (url) URL.revokeObjectURL(url);
      setExporting(false);
    }
  }
  const balance = summary.data;
  return (
    <div className={styles.workspace}>
      <FinanceFeedback
        error={summary.error || policy.error || message.error}
        notice={message.notice}
      />
      <div className={styles.actions}>
        <span className={styles.muted}>
          {balance?.name || "Shop commission account"}
        </span>
        <button className="outline-btn" onClick={refresh}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <FinanceMetrics
        items={[
          {
            label: "Outstanding commission",
            value: balance?.outstandingMinor,
            detail: "Includes amounts on hold",
          },
          {
            label: "Payable now",
            value: balance?.payableMinor,
            detail: "Payment period completed, no open holds",
          },
          {
            label: "Awaiting verification",
            value: balance?.pendingMinor,
            detail: "Balance changes after approval",
          },
          {
            label: "Overdue",
            value: balance?.overdueMinor,
            detail: "Payment due date has passed",
            warn: Boolean(balance?.overdueMinor),
          },
        ]}
      />
      {balance && (
        <p className={styles.muted}>
          On hold: <b>{money(balance.heldMinor)}</b> · Confirmed payments:{" "}
          <b>{money(balance.paidMinor)}</b> · Refund commission credits:{" "}
          <b>{money(balance.creditedMinor)}</b>
          {balance.creditBalanceMinor > 0 && (
            <>
              {" "}
              · Credit carried forward:{" "}
              <b>{money(balance.creditBalanceMinor)}</b>
            </>
          )}
        </p>
      )}
      <div className={styles.split}>
        <FinanceCard
          title="Commission policy"
          description="Buyer COD money is collected by your shop."
        >
          {policy.loading ? (
            <p>Loading policy…</p>
          ) : policy.data ? (
            <>
              <div className={styles.policyRate}>
                <Wallet size={24} />
                <strong>Product rates</strong>
                <span>on merchandise subtotal · delivery excluded</span>
              </div>
              <p className={styles.muted}>
                Each item saves its admin-assigned rate and commission amount at
                checkout. Charges appear after delivery and COD collection.
                Payment is due {policy.data.paymentDays} days from successful
                delivery for new orders. Open returns and manual holds pause
                payment.
              </p>
              <p className={styles.muted}>
                Products without an assigned rate have no commission. Existing
                orders retain their saved rates and payment terms.
              </p>
            </>
          ) : null}
        </FinanceCard>
        {!admin && (
          <FinanceCard
            title="Pay HelaCart commission"
            description="Bank transfer details supplied by the owner."
          >
            {policy.data?.accountNumber ? (
              <dl className={styles.details}>
                <dt>Bank</dt>
                <dd>{policy.data.bankName}</dd>
                <dt>Account holder</dt>
                <dd>{policy.data.accountName}</dd>
                <dt>Account number</dt>
                <dd>{policy.data.accountNumber}</dd>
              </dl>
            ) : (
              <p>
                Bank details have not been configured. Contact HelaCart before
                transferring money.
              </p>
            )}
            {policy.data?.instructions && (
              <p className={styles.muted}>{policy.data.instructions}</p>
            )}
            {balance && (
              <PaymentSubmission
                key={sellerId}
                root={root}
                available={balance.availableToSubmitMinor}
                disabled={isPreview || !policy.data?.accountNumber}
                request={request}
                onSaved={() => {
                  setTab("payments");
                  setPaymentPage(1);
                  refresh();
                }}
              />
            )}
          </FinanceCard>
        )}
      </div>
      <section className={styles.card}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Commission account sections"
        >
          {[
            ["charges", "Order charges"],
            ["payments", "Payment history"],
            ["statement", "Monthly statement"],
          ].map(([key, label]) => (
            <button
              key={key}
              id={`commission-tab-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls={`commission-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onKeyDown={(event) => {
                const keys = ["charges", "payments", "statement"];
                const index = keys.indexOf(tab);
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next =
                    keys[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
                  setTab(next);
                  document.getElementById(`commission-tab-${next}`)?.focus();
                }
              }}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`commission-panel-${tab}`}
          aria-labelledby={`commission-tab-${tab}`}
        >
          {tab === "charges" && (
            <>
              <FinanceFeedback error={charges.error} />
              <FinanceTable
                headers={[
                  "Seller order",
                  "Merchandise",
                  "Rate / commission",
                  "Availability / due",
                  "Refunds",
                  ...(admin ? ["Action"] : []),
                ]}
                empty={
                  charges.loading
                    ? "Loading charges…"
                    : !charges.data?.items.length
                      ? "No commission charges yet. Eligible new orders appear after delivery."
                      : undefined
                }
              >
                {charges.data?.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{shortId(row.sellerOrderId)}</strong>
                      {row.orderItem && (
                        <small>
                          {row.orderItem.productTitle} · {row.orderItem.sku}
                        </small>
                      )}
                      <small>{dateTime(row.createdAt)}</small>
                    </td>
                    <td>{money(row.baseMinor)}</td>
                    <td>
                      {rateLabel(row.rateBps)}
                      <strong>{money(row.amountMinor)}</strong>
                    </td>
                    <td>
                      <span>
                        {row.manualOnHold
                          ? "Admin hold"
                          : row.returnOnHold
                            ? "Return case on hold"
                            : new Date(row.holdUntil) > new Date()
                              ? "Waiting for due date"
                              : "Payable"}
                      </span>
                      <small>Available {dateTime(row.holdUntil)}</small>
                      <small>Due {dateTime(row.dueAt)}</small>
                      {row.manualOnHold && (
                        <small>{row.holds?.[0]?.reason}</small>
                      )}
                    </td>
                    <td>
                      {money(row.creditedMinor)}
                      <small>
                        Refunded goods {money(row.refundedBaseMinor)}
                      </small>
                      {!!row.refunds?.length && (
                        <details>
                          <summary>Credit history</summary>
                          {row.refunds.map((credit) => (
                            <div key={credit.id}>
                              <small>
                                <b>{credit.reference}</b> ·{" "}
                                {money(credit.creditMinor)}
                                <br />
                                {credit.reason}
                              </small>
                              {credit.correction ? (
                                <small>
                                  Corrected{" "}
                                  {dateTime(credit.correction.createdAt)} ·{" "}
                                  {credit.correction.reason}
                                </small>
                              ) : (
                                admin && (
                                  <button
                                    className="outline-btn"
                                    disabled={isPreview}
                                    onClick={() =>
                                      setCorrection({
                                        kind: "REFUND",
                                        id: credit.id,
                                        sellerId,
                                        reference: credit.reference,
                                      })
                                    }
                                  >
                                    Correct credit record
                                  </button>
                                )
                              )}
                            </div>
                          ))}
                        </details>
                      )}
                    </td>
                    {admin && (
                      <td>
                        <button
                          className="outline-btn"
                          disabled={
                            isPreview || row.refundedBaseMinor >= row.baseMinor
                          }
                          onClick={() => setRefund(row)}
                        >
                          Record refund credit
                        </button>
                        <button
                          className="outline-btn"
                          disabled={isPreview}
                          onClick={() => setHold(row)}
                        >
                          {row.manualOnHold ? "Release hold" : "Hold payment"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </FinanceTable>
              <FinancePager
                data={charges.data}
                onPage={setChargePage}
                loading={charges.loading}
              />
            </>
          )}
          {tab === "payments" && (
            <>
              <FinanceFeedback error={payments.error} />
              <PaymentTable
                data={payments.data}
                loading={payments.loading}
                isPreview={isPreview}
                onReceipt={setReceiptId}
                onCorrect={
                  admin
                    ? (row) =>
                        setCorrection({
                          kind: "PAYMENT",
                          id: row.id,
                          sellerId: row.sellerId,
                          reference: row.reference,
                        })
                    : undefined
                }
              />
              <FinancePager
                data={payments.data}
                onPage={setPaymentPage}
                loading={payments.loading}
              />
            </>
          )}
          {tab === "statement" && (
            <>
              <div className={styles.toolbar}>
                <label>
                  Statement month
                  <input
                    type="month"
                    min="2000-01"
                    max="2099-12"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) {
                        setMonth(e.target.value);
                        setStatementPage(1);
                      }
                    }}
                  />
                </label>
                <button
                  className="outline-btn"
                  disabled={isPreview || exporting || !statement.data}
                  onClick={() => void exportStatement()}
                >
                  <Download size={16} />
                  {exporting ? "Exporting…" : "Download statement"}
                </button>
              </div>
              <FinanceFeedback error={statement.error} />
              {statement.data && (
                <p className={styles.muted}>
                  Opening balance: <b>{money(statement.data.openingMinor)}</b> ·
                  Closing balance: <b>{money(statement.data.closingMinor)}</b> ·
                  Negative amounts reduce commission owed. Statements use Sri
                  Lanka calendar months.
                </p>
              )}
              <FinanceTable
                headers={["Recorded", "Entry", "Reference", "Amount", "Note"]}
                empty={
                  statement.loading
                    ? "Loading statement…"
                    : !statement.data?.items.length
                      ? "No entries in this month."
                      : undefined
                }
              >
                {statement.data?.items.map((row) => (
                  <tr key={`${row.kind}-${row.id}`}>
                    <td>{dateTime(row.createdAt)}</td>
                    <td>{row.kind.replaceAll("_", " ")}</td>
                    <td className={styles.reference}>
                      {row.kind === "CHARGE"
                        ? shortId(row.reference)
                        : row.reference}
                    </td>
                    <td>{money(row.amountMinor)}</td>
                    <td>{row.note || "—"}</td>
                  </tr>
                ))}
              </FinanceTable>
              <FinancePager
                data={statement.data}
                onPage={setStatementPage}
                loading={statement.loading}
              />
            </>
          )}
        </div>
      </section>
      {correction && (
        <CommissionCorrectionDialog
          target={correction}
          request={request}
          onClose={() => setCorrection(null)}
          onSaved={() => {
            refresh();
            setMessage({
              error: "",
              notice:
                "Correction recorded. The original record remains in the account history.",
            });
          }}
        />
      )}
      {receiptId && (
        <ReceiptViewer
          key={receiptId}
          path={
            admin
              ? `/admin/commission/payments/${receiptId}/receipt`
              : `${root}/payments/${receiptId}/receipt`
          }
          onClose={() => setReceiptId("")}
        />
      )}
      {refund && (
        <RefundDialog
          charge={refund}
          root={root}
          request={request}
          onClose={() => setRefund(null)}
          onSaved={() => {
            refresh();
            setMessage({
              error: "",
              notice:
                "Refund commission credit recorded. No bank transfer or stock change was performed.",
            });
          }}
        />
      )}
      {hold && (
        <CommissionHoldDialog
          charge={hold}
          request={request}
          onClose={() => setHold(null)}
          onSaved={() => {
            refresh();
            setMessage({
              error: "",
              notice: "Commission hold updated. Balance refreshed.",
            });
          }}
        />
      )}
    </div>
  );
}

export function PaymentTable({
  data,
  loading,
  isPreview,
  onReceipt,
  onReview,
  onCorrect,
}: {
  data: Page<CommissionPayment> | null;
  loading: boolean;
  isPreview: boolean;
  onReceipt: (id: string) => void;
  onReview?: (payment: CommissionPayment) => void;
  onCorrect?: (payment: CommissionPayment) => void;
}) {
  return (
    <FinanceTable
      headers={["Transfer", "Shop / amount", "Status", "Review", "Actions"]}
      empty={
        loading
          ? "Loading payments…"
          : !data?.items.length
            ? "No payment submissions found."
            : undefined
      }
    >
      {data?.items.map((row) => (
        <tr key={row.id}>
          <td className={styles.reference}>
            <strong>{row.reference}</strong>
            <small>Paid {row.paidOn}</small>
            <small>Submitted {dateTime(row.createdAt)}</small>
            {row.note && <small>{row.note}</small>}
          </td>
          <td>
            {row.seller?.name}
            <strong>{money(row.amountMinor)}</strong>
          </td>
          <td>
            <AdminBadge value={row.correction ? "CORRECTED" : row.status} />
          </td>
          <td>
            {row.reviewNote || "Awaiting owner verification"}
            {row.reviewedAt && <small>{dateTime(row.reviewedAt)}</small>}
            {row.correction && (
              <small>
                Correction: {row.correction.reason} ·{" "}
                {dateTime(row.correction.createdAt)}
              </small>
            )}
          </td>
          <td>
            <div className={styles.rowActions}>
              <button
                className="outline-btn"
                disabled={isPreview}
                onClick={() => onReceipt(row.id)}
              >
                <Receipt size={14} /> Receipt
              </button>
              {onReview && row.status === "PENDING" && (
                <button
                  className="primary-btn"
                  disabled={isPreview}
                  onClick={() => onReview(row)}
                >
                  <FileCheck2 size={14} /> Review
                </button>
              )}
              {onCorrect && row.status === "APPROVED" && !row.correction && (
                <button
                  className="outline-btn"
                  disabled={isPreview}
                  onClick={() => onCorrect(row)}
                >
                  Correct approval
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </FinanceTable>
  );
}

function PaymentSubmission({
  root,
  available,
  disabled,
  request,
  onSaved,
}: {
  root: string;
  available: number;
  disabled: boolean;
  request: FinanceRequest;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [paidOn, setPaidOn] = useState(localToday),
    [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const operation = useRef(false),
    intent = useRef<{ signature: string; key: string } | null>(null),
    input = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || operation.current) return;
    const minor = rupeesToMinor(amount);
    if (!minor || minor > available || minor > 1000000000) {
      setError("Enter an amount within the commission available to submit.");
      return;
    }
    if (
      !file ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG or WebP receipt up to 5 MB.");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([
      amount,
      reference,
      paidOn,
      note,
      file.name,
      file.size,
      file.lastModified,
    ]);
    if (intent.current?.signature !== signature)
      intent.current = { signature, key: crypto.randomUUID() };
    const body = new FormData();
    body.set("requestKey", intent.current.key);
    body.set("amountMinor", String(minor));
    body.set("reference", reference.trim());
    body.set("paidOn", paidOn);
    body.set("note", note.trim());
    body.set("receipt", file);
    try {
      await request(`${root}/payments`, "POST", body);
      intent.current = null;
      setAmount("");
      setReference("");
      setNote("");
      setFile(null);
      if (input.current) input.current.value = "";
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <p className={styles.muted}>
        Available to submit: <b>{money(available)}</b>. Pending submissions
        reserve this amount until reviewed.
      </p>
      <fieldset disabled={disabled || busy || available <= 0}>
        <label>
          Transfer amount (LKR)
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500.00"
          />
        </label>
        <label>
          Bank transaction reference
          <input
            required
            minLength={3}
            maxLength={100}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label>
          Payment date
          <input
            required
            type="date"
            min="2000-01-01"
            max={localToday()}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </label>
        <label>
          Receipt image
          <input
            ref={input}
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <small>
            JPEG, PNG or WebP · up to 5 MB · private to your shop and HelaCart
            administrators
          </small>
        </label>
        <label>
          Note (optional)
          <textarea
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </label>
        <button className="primary-btn" type="submit">
          {busy ? "Submitting…" : "Submit payment for verification"}
        </button>
      </fieldset>
      <FinanceFeedback error={error} />
    </form>
  );
}
function RefundDialog({
  charge,
  root,
  request,
  onSaved,
  onClose,
}: {
  charge: CommissionCharge;
  root: string;
  request: FinanceRequest;
  onSaved: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    key = useRef(crypto.randomUUID()),
    operation = useRef(false);
  const [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (operation.current || !confirmed) return;
    const baseMinor = rupeesToMinor(amount);
    if (!baseMinor || baseMinor > charge.baseMinor - charge.refundedBaseMinor) {
      setError("Enter a refund within the remaining merchandise amount");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`${root}/refunds`, "POST", {
        requestKey: key.current,
        chargeId: charge.id,
        baseMinor,
        reference: reference.trim(),
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        <div className={styles.cardHead}>
          <h2>Record refund commission credit</h2>
          <button
            className="outline-btn"
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close refund form"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Order {shortId(charge.sellerOrderId)} · Remaining goods value{" "}
          {money(charge.baseMinor - charge.refundedBaseMinor)}. Enter the actual
          merchandise refund, excluding delivery. The original commission rate
          determines the credit.
        </p>
        <fieldset disabled={busy}>
          <label>
            Merchandise refunded (LKR)
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Refund transaction / case reference
            <input
              required
              minLength={3}
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Reason and evidence summary
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified that this merchandise refund occurred. This records
            commission credit only.
          </label>
          <button className="primary-btn" type="submit">
            {busy ? "Recording…" : "Record credit"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
