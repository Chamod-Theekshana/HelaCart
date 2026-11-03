"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, RefreshCw, Settings2, X } from "lucide-react";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { AdminHeading } from "@/components/admin-ui";
import {
  CommissionAccount,
  FinanceCard,
  FinanceFeedback,
  FinanceMetrics,
  FinancePager,
  FinanceTable,
  PaymentTable,
  ReceiptViewer,
  useFinanceResource,
} from "@/components/commission-workspace";
import { errorMessage, money } from "@/lib/api";
import { dateTime } from "@/lib/admin";
import {
  emptyPage,
  previewBalance,
  previewPayments,
  previewPolicy,
  rateLabel,
  type CommissionBalance,
  type CommissionHistory,
  type CommissionPayment,
  type CommissionPolicy,
  type FinanceRequest,
} from "@/lib/commission";
import type { Page } from "@/lib/shops";
import styles from "@/components/commission-workspace.module.css";
import {
  CommissionCorrectionDialog,
  type CommissionCorrectionTarget,
} from "@/components/commission-correction-dialog";
import { ProductCommissionManagement } from "@/components/product-commission-management";

export default function AdminCommissionScreen() {
  const { user } = useShop();
  return <AdminCommissionWorkspace key={user?.uid || "preview"} />;
}
function AdminCommissionWorkspace() {
  const [correction, setCorrection] =
    useState<CommissionCorrectionTarget | null>(null);
  const { request, isPreview } = useAdmin();
  const [revision, setRevision] = useState(0),
    [tab, setTab] = useState("shops"),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [status, setStatus] = useState("PENDING");
  const [shopPage, setShopPage] = useState(1),
    [paymentPage, setPaymentPage] = useState(1),
    [selected, setSelected] = useState(""),
    [receiptId, setReceiptId] = useState("");
  const [settings, setSettings] = useState(false),
    [review, setReview] = useState<CommissionPayment | null>(null),
    [message, setMessage] = useState({ error: "", notice: "" }),
    [reminding, setReminding] = useState("");
  const summary = useFinanceResource<Partial<CommissionBalance>>(
    "/admin/commission/summary",
    previewBalance,
    request,
    isPreview,
    revision,
  );
  const policy = useFinanceResource<CommissionPolicy>(
    "/admin/commission/policy",
    previewPolicy,
    request,
    isPreview,
    revision,
  );
  const shops = useFinanceResource<Page<CommissionBalance>>(
    `/admin/commission/sellers?page=${shopPage}&q=${encodeURIComponent(q)}&filter=${filter}`,
    emptyPage([previewBalance]),
    request,
    isPreview,
    revision,
  );
  const payments = useFinanceResource<Page<CommissionPayment>>(
    tab === "payments"
      ? `/admin/commission/payments?page=${paymentPage}&status=${status}`
      : "",
    emptyPage(previewPayments),
    request,
    isPreview,
    revision,
  );
  const history = useFinanceResource<CommissionHistory[]>(
    tab === "history" ? "/admin/commission/policy/history" : "",
    [],
    request,
    isPreview,
    revision,
  );
  const root = "/admin/commission";
  async function remind(id: string) {
    if (isPreview || reminding) return;
    setReminding(id);
    setMessage({ error: "", notice: "" });
    try {
      const result = await request<{ sent: boolean; message?: string }>(
        `${root}/sellers/${id}/reminder`,
        "POST",
      );
      setMessage({
        error: "",
        notice: result.sent
          ? "Reminder sent to shop members."
          : result.message || "Already reminded today.",
      });
    } catch (cause) {
      setMessage({ error: errorMessage(cause), notice: "" });
    } finally {
      setReminding("");
    }
  }
  function refresh() {
    setRevision((v) => v + 1);
  }
  return (
    <>
      <AdminHeading
        eyebrow="PLATFORM FINANCES"
        title="Commission & collections"
        description="Track commission owed by shops and verify seller bank payments."
        action={
          <button
            className="outline-btn"
            disabled={!policy.data || isPreview}
            onClick={() => setSettings(true)}
          >
            <Settings2 size={16} /> Commission settings
          </button>
        }
      />
      <div className={styles.workspace}>
        <FinanceFeedback
          error={summary.error || policy.error || message.error}
          notice={message.notice}
        />
        <div className={styles.banner}>
          Sellers collect buyer COD payments and pay HelaCart commission
          separately. Assign rates separately in Product rates. Unassigned
          products have no commission. Payment is due{" "}
          {policy.data?.paymentDays ?? 14} days after delivery; delivery fees
          are excluded.
        </div>
        <FinanceMetrics
          items={[
            {
              label: "Commission charged",
              value: summary.data?.chargedMinor,
              detail: "Delivered orders, before credits",
            },
            {
              label: "Confirmed collections",
              value: summary.data?.paidMinor,
              detail: "Bank payments verified by owner",
            },
            {
              label: "Outstanding",
              value: summary.data?.outstandingMinor,
              detail: "Includes waiting periods and case holds",
            },
            {
              label: "Overdue",
              value: summary.data?.overdueMinor,
              warn: Boolean(summary.data?.overdueMinor),
              detail: "Eligible commission past due",
            },
          ]}
        />
        <p className={styles.muted}>
          Awaiting payment verification:{" "}
          <b>{summary.data ? money(summary.data.pendingMinor || 0) : "—"}</b> ·
          Refund commission credits:{" "}
          <b>{summary.data ? money(summary.data.creditedMinor || 0) : "—"}</b>.
          Commission figures are platform revenue and receivables; operating
          costs are accounted for separately.
        </p>
        {selected ? (
          <>
            <button
              className={styles.back}
              onClick={() => {
                setSelected("");
                refresh();
              }}
            >
              <ArrowLeft size={16} /> Back to all shops
            </button>
            <CommissionAccount
              key={selected}
              sellerId={selected}
              request={request}
              isPreview={isPreview}
              admin
            />
          </>
        ) : (
          <FinanceCard
            title="Collection workspace"
            action={
              <button className="outline-btn" onClick={refresh}>
                <RefreshCw size={15} /> Refresh
              </button>
            }
          >
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Commission management"
            >
              {[
                ["shops", "Shop balances"],
                ["products", "Product rates"],
                ["payments", "Payment submissions"],
                ["history", "Policy history"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "shops" && (
              <>
                <div className={styles.toolbar}>
                  <input
                    aria-label="Search shop balances"
                    placeholder="Search shop name or slug"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setShopPage(1);
                    }}
                  />
                  <select
                    aria-label="Filter shop balances"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setShopPage(1);
                    }}
                  >
                    <option value="ALL">All shops</option>
                    <option value="OUTSTANDING">Outstanding balance</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="PENDING">Payment awaiting review</option>
                  </select>
                </div>
                <FinanceFeedback error={shops.error} />
                <FinanceTable
                  headers={[
                    "Shop",
                    "Outstanding / on hold",
                    "Payable / overdue",
                    "Awaiting verification",
                    "Actions",
                  ]}
                  empty={
                    shops.loading
                      ? "Loading balances…"
                      : !shops.data?.items.length
                        ? "No matching shop accounts."
                        : undefined
                  }
                >
                  {shops.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>
                          {row.slug} · {row.status.toLowerCase()}
                        </small>
                      </td>
                      <td>
                        <strong>{money(row.outstandingMinor)}</strong>
                        <small>On hold {money(row.heldMinor)}</small>
                        {row.creditBalanceMinor > 0 && (
                          <small>Credit {money(row.creditBalanceMinor)}</small>
                        )}
                      </td>
                      <td>
                        <strong>{money(row.payableMinor)}</strong>
                        <small>Overdue {money(row.overdueMinor)}</small>
                      </td>
                      <td>{money(row.pendingMinor)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className="outline-btn"
                            onClick={() => setSelected(row.id)}
                          >
                            View account
                          </button>
                          <button
                            className="outline-btn"
                            disabled={
                              isPreview ||
                              row.overdueMinor <= 0 ||
                              Boolean(reminding)
                            }
                            onClick={() => void remind(row.id)}
                          >
                            {reminding === row.id
                              ? "Sending…"
                              : "Send reminder"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </FinanceTable>
                <FinancePager
                  data={shops.data}
                  onPage={setShopPage}
                  loading={shops.loading}
                />
              </>
            )}
            {tab === "payments" && (
              <>
                <div className={styles.toolbar}>
                  <label>
                    Payment status
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPaymentPage(1);
                      }}
                    >
                      <option value="PENDING">Awaiting verification</option>
                      <option value="APPROVED">Confirmed</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="ALL">All submissions</option>
                    </select>
                  </label>
                </div>
                <FinanceFeedback error={payments.error} />
                <PaymentTable
                  data={payments.data}
                  loading={payments.loading}
                  isPreview={isPreview}
                  onReceipt={setReceiptId}
                  onReview={setReview}
                  onCorrect={(row) =>
                    setCorrection({
                      kind: "PAYMENT",
                      id: row.id,
                      sellerId: row.sellerId,
                      reference: row.reference,
                    })
                  }
                />
                <FinancePager
                  data={payments.data}
                  onPage={setPaymentPage}
                  loading={payments.loading}
                />
              </>
            )}
            {tab === "history" && (
              <>
                <FinanceFeedback error={history.error} />
                <FinanceTable
                  headers={["Version / date", "Changed by", "Policy", "Reason"]}
                  empty={
                    history.loading
                      ? "Loading history…"
                      : !history.data?.length
                        ? "No policy changes recorded."
                        : undefined
                  }
                >
                  {history.data?.map((row) => (
                    <tr key={row.id}>
                      <td>
                        Version {row.version}
                        <small>{dateTime(row.createdAt)}</small>
                      </td>
                      <td>{row.actor.email}</td>
                      <td>
                        {row.after.enabled
                          ? `Legacy rate ${rateLabel(row.after.rateBps ?? 0)}`
                          : "Product commission settings"}
                        <small>
                          {row.after.paymentDays} days · saved order terms apply
                        </small>
                      </td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </FinanceTable>
                <p className={styles.muted}>
                  Latest 20 policy decisions. Older decisions remain in the
                  audit history.
                </p>
              </>
            )}
            {tab === "products" && (
              <ProductCommissionManagement
                request={request}
                isPreview={isPreview}
              />
            )}
          </FinanceCard>
        )}
      </div>
      {settings && policy.data && (
        <PolicyDialog
          key={policy.data.version}
          policy={policy.data}
          request={request}
          onClose={() => setSettings(false)}
          onSaved={() => {
            refresh();
            setMessage({
              error: "",
              notice:
                "Policy saved. New orders use these terms; existing orders retain their original terms.",
            });
          }}
        />
      )}
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
                "Payment correction recorded with its original approval history.",
            });
          }}
        />
      )}
      {review && (
        <ReviewDialog
          payment={review}
          request={request}
          onClose={() => setReview(null)}
          onSaved={() => {
            refresh();
            setMessage({
              error: "",
              notice: "Payment review recorded. Shop balance refreshed.",
            });
          }}
        />
      )}
      {receiptId && (
        <ReceiptViewer
          key={receiptId}
          path={`${root}/payments/${receiptId}/receipt`}
          onClose={() => setReceiptId("")}
        />
      )}
    </>
  );
}

export function PolicyDialog({
  policy,
  request,
  onSaved,
  onClose,
}: {
  policy: CommissionPolicy;
  request: FinanceRequest;
  onSaved: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [days, setDays] = useState(String(policy.paymentDays));
  const [bank, setBank] = useState(policy.bankName || ""),
    [name, setName] = useState(policy.accountName || ""),
    [account, setAccount] = useState(policy.accountNumber || ""),
    [instructions, setInstructions] = useState(policy.instructions || ""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    const paymentDays = Number(days);
    if (!Number.isInteger(paymentDays) || paymentDays < 1 || paymentDays > 90) {
      setError("Use a payment period of 1–90 days from delivery.");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request("/admin/commission/policy", "PATCH", {
        version: policy.version,
        paymentDays,
        bankName: bank.trim(),
        accountName: name.trim(),
        accountNumber: account.trim(),
        instructions: instructions.trim(),
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
      <form className={styles.form} onSubmit={(e) => void save(e)}>
        <div className={styles.cardHead}>
          <h2>Commission settings</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          Each product uses its admin-assigned rate. The payment period starts
          at successful delivery. Changes apply to new orders; existing orders
          keep their saved terms. Open returns and manual holds pause payment.
        </p>
        <fieldset disabled={busy}>
          <div className={styles.formGrid}>
            <label>
              Commission due after delivery (days)
              <input
                required
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
            <label>
              Bank name
              <input
                maxLength={100}
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
            </label>
            <label>
              Account holder
              <input
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={styles.wide}>
              Bank account number
              <input
                maxLength={50}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </label>
          </div>
          <label>
            Payment instructions
            <textarea
              maxLength={1000}
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <label>
            Reason for this change
            <textarea
              required
              minLength={10}
              maxLength={500}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn">
            {busy ? "Saving…" : "Save policy"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
function ReviewDialog({
  payment,
  request,
  onSaved,
  onClose,
}: {
  payment: CommissionPayment;
  request: FinanceRequest;
  onSaved: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [decision, setDecision] = useState("APPROVED"),
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
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/commission/payments/${payment.id}`, "PATCH", {
        decision,
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
          <h2>Verify bank payment</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close review"
          >
            <X size={18} />
          </button>
        </div>
        <p>
          <b>{payment.reference}</b> · {money(payment.amountMinor)} ·{" "}
          {payment.seller?.name}. Check the actual bank transaction, amount and
          reference. A receipt alone does not confirm funds.
        </p>
        <fieldset disabled={busy}>
          <label>
            Decision
            <select
              value={decision}
              onChange={(e) => {
                setDecision(e.target.value);
                setConfirmed(false);
              }}
            >
              <option value="APPROVED">Confirm received payment</option>
              <option value="REJECTED">Reject submission</option>
            </select>
          </label>
          <label>
            Verification note / rejection reason
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
            {decision === "APPROVED"
              ? "I verified this amount was received in the HelaCart bank account."
              : "I reviewed this submission and recorded the reason for rejection."}
          </label>
          <button className="primary-btn" type="submit">
            {busy
              ? "Recording…"
              : decision === "APPROVED"
                ? "Confirm payment"
                : "Reject submission"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
