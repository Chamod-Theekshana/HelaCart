"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useShop } from "./shop-provider";
import { useBuyerAfterSalesRequest } from "./after-sales-client";
import { useFinanceResource, FinanceFeedback } from "./commission-workspace";
import type { ReturnOptions } from "@/lib/after-sales";
import { errorMessage, money } from "@/lib/api";
import { deliveryDate } from "@/lib/delivery";
import styles from "./after-sales.module.css";
export function ItemReturnDialog({
  sellerOrderId,
  onClose,
  onSaved,
}: {
  sellerOrderId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { isPreview } = useShop(),
    request = useBuyerAfterSalesRequest(),
    dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false),
    intent = useRef({ payload: "", key: "" });
  const [attempt, setAttempt] = useState(0),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const data = useFinanceResource<ReturnOptions>(
    `/me/after-sales/return-options/${sellerOrderId}`,
    { sellerOrderId, eligible: false, closesAt: null, items: [] },
    request,
    isPreview,
    attempt,
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current || isPreview || !data.data?.eligible) return;
    const items = data.data.items
      .filter((i) => (quantities[i.orderItemId] ?? 0) > 0)
      .map((i) => ({
        orderItemId: i.orderItemId,
        quantity: quantities[i.orderItemId],
      }));
    if (
      !items.length ||
      items.some(
        (i) =>
          !Number.isInteger(i.quantity) ||
          i.quantity >
            data.data!.items.find((v) => v.orderItemId === i.orderItemId)!
              .remainingQuantity,
      )
    ) {
      setError(
        "Select at least one item and a quantity within the remaining return allowance.",
      );
      return;
    }
    const body = { sellerOrderId, reason: reason.trim(), items },
      payload = JSON.stringify(body);
    if (intent.current.payload !== payload)
      intent.current = { payload, key: crypto.randomUUID() };
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request("/me/returns", "POST", {
        ...body,
        requestKey: intent.current.key,
      });
      onSaved();
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
        <div className={styles.heading}>
          <h2>Return items</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close return request"
          >
            <X size={18} />
          </button>
        </div>
        <FinanceFeedback error={error || data.error} />
        {data.error && (
          <button
            type="button"
            className="outline-btn"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Retry item eligibility
          </button>
        )}
        {data.loading ? (
          <p>Checking return eligibility…</p>
        ) : data.data ? (
          <>
            <p className={styles.muted}>
              {data.data.eligible
                ? `Select only the items and quantities you need to return.${data.data.closesAt ? ` Return window closes ${deliveryDate(data.data.closesAt)}.` : ""}`
                : "This order is outside the return window or is not yet delivered."}
            </p>
            <fieldset disabled={busy || isPreview || !data.data.eligible}>
              {data.data.items.map((item) => (
                <div className={styles.item} key={item.orderItemId}>
                  <div>
                    <strong>{item.productTitle}</strong>
                    <small>
                      {item.sku} · Purchased {item.quantity} · Remaining{" "}
                      {item.remainingQuantity}
                    </small>
                    <small>{money(item.unitMinor)} per item</small>
                  </div>
                  <label>
                    Return quantity
                    <input
                      type="number"
                      min={0}
                      max={item.remainingQuantity}
                      step={1}
                      value={quantities[item.orderItemId] ?? 0}
                      disabled={!item.remainingQuantity}
                      onChange={(e) =>
                        setQuantities((old) => ({
                          ...old,
                          [item.orderItemId]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
              <label>
                Reason for return
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="primary-btn"
                type="submit"
                disabled={!data.data.items.some((i) => i.remainingQuantity > 0)}
              >
                {busy ? "Submitting…" : "Submit item return"}
              </button>
            </fieldset>
          </>
        ) : null}
      </form>
    </dialog>
  );
}
