"use client";
import { useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { useSeller } from "./seller-provider";
import { useShop } from "./shop-provider";
import { SellerPageHeading } from "./seller-ui";
import { useFinanceResource } from "./commission-workspace";
import {
  deliveryDistricts,
  type DeliverySettings,
  type DistrictRate,
} from "@/lib/delivery";
import { errorMessage, money } from "@/lib/api";
import { rupeesToMinor } from "@/lib/seller";
import type { FinanceRequest } from "@/lib/commission";
import styles from "./delivery-workspace.module.css";
export default function SellerDeliveryEditor() {
  const { seller, request, isPreview, refreshProfile } = useSeller(),
    { user } = useShop();
  const [attempt, setAttempt] = useState(0),
    [notice, setNotice] = useState("");
  const sample: DeliverySettings = {
    id: seller?.id ?? "preview",
    shippingFeeLkrMinor: seller?.shippingFeeLkrMinor ?? 35000,
    deliveryRevision: 0,
    deliveryRules: [],
    freeShippingThresholdMinor: null,
    deliveryMinDays: null,
    deliveryMaxDays: null,
  };
  const resource = useFinanceResource<DeliverySettings>(
    seller ? `/sellers/${seller.id}/delivery-settings` : "",
    sample,
    request,
    isPreview,
    attempt,
  );
  return (
    <>
      <SellerPageHeading
        kicker="LOGISTICS & FULFILMENT"
        title="Delivery rates & settings"
        description="Set your standard fee, district overrides and optional free-delivery offers."
      />
      {notice && (
        <div className="message info" role="status">
          {notice}
        </div>
      )}
      {resource.error && (
        <div className="message error" role="alert">
          {resource.error}
          <button
            className="outline-btn"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {resource.loading ? (
        <div className="seller-state">Loading delivery settings…</div>
      ) : resource.data && seller ? (
        <DeliveryForm
          key={`${user?.uid}:${seller.id}:${resource.data.deliveryRevision}`}
          data={resource.data}
          request={request}
          isPreview={isPreview}
          onSaved={async () => {
            setAttempt((v) => v + 1);
            setNotice(
              "Delivery settings saved. Existing orders retain their delivery charge and estimate.",
            );
            await refreshProfile();
          }}
        />
      ) : null}
    </>
  );
}
function DeliveryForm({
  data,
  request,
  isPreview,
  onSaved,
}: {
  data: DeliverySettings;
  request: FinanceRequest;
  isPreview: boolean;
  onSaved: () => Promise<void>;
}) {
  const [fee, setFee] = useState(
      data.shippingFeeLkrMinor == null
        ? ""
        : (data.shippingFeeLkrMinor / 100).toFixed(2),
    ),
    [threshold, setThreshold] = useState(
      data.freeShippingThresholdMinor == null
        ? ""
        : (data.freeShippingThresholdMinor / 100).toFixed(2),
    ),
    [min, setMin] = useState(data.deliveryMinDays?.toString() ?? ""),
    [max, setMax] = useState(data.deliveryMaxDays?.toString() ?? ""),
    [rules, setRules] = useState(
      data.deliveryRules.map((r) => ({
        ...r,
        amount: (r.feeMinor / 100).toFixed(2),
      })),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const operation = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current || isPreview) return;
    const base = rupeesToMinor(fee),
      free = threshold.trim() ? rupeesToMinor(threshold) : null,
      minDays = min.trim() ? Number(min) : null,
      maxDays = max.trim() ? Number(max) : null;
    const districtRates: DistrictRate[] = [];
    if (
      base == null ||
      base > 100000000 ||
      (threshold.trim() && (free == null || free < 1 || free > 1000000000)) ||
      (minDays == null) !== (maxDays == null) ||
      (minDays != null &&
        (!Number.isInteger(minDays) ||
          !Number.isInteger(maxDays) ||
          minDays < 1 ||
          maxDays! < minDays ||
          maxDays! > 60))
    ) {
      setError(
        "Enter valid fees and a complete delivery estimate from 1–60 days, or leave both estimate fields blank.",
      );
      return;
    }
    for (const r of rules) {
      const amount = rupeesToMinor(r.amount);
      if (amount == null || amount > 100000000) {
        setError(`Enter a valid fee for ${r.district}.`);
        return;
      }
      districtRates.push({
        district: r.district,
        available: r.available,
        feeMinor: amount,
      });
    }
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`/sellers/${data.id}/delivery-settings`, "PUT", {
        version: data.deliveryRevision,
        shippingFeeLkrMinor: base,
        freeShippingThresholdMinor: free,
        deliveryMinDays: minDays,
        deliveryMaxDays: maxDays,
        districtRates,
      });
      await onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={(e) => void save(e)}>
      <fieldset disabled={busy || isPreview}>
        <section className={styles.card}>
          <div className={styles.heading}>
            <h2>Standard delivery</h2>
            <Truck size={21} />
          </div>
          <p className={styles.muted}>
            Charged once per shop order. Current standard fee:{" "}
            <b>
              {data.shippingFeeLkrMinor == null
                ? "Not configured"
                : money(data.shippingFeeLkrMinor)}
            </b>
            .
          </p>
          <div className={styles.grid}>
            <label>
              Standard fee (LKR)
              <input
                required
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <small>Use 0 for free delivery.</small>
            </label>
            <label>
              Free delivery above subtotal (LKR, optional)
              <input
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="No threshold"
              />
              <small>
                Applies to merchandise from your shop, within districts you
                serve.
              </small>
            </label>
            <label>
              Minimum delivery estimate (days)
              <input
                type="number"
                min={1}
                max={60}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Maximum delivery estimate (days)
              <input
                type="number"
                min={1}
                max={60}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <p className={styles.muted}>
            Estimates are calendar days after dispatch. Leave both blank if you
            cannot provide a range. Existing orders keep the estimate agreed at
            checkout.
          </p>
        </section>
        <section className={styles.card}>
          <h2>District rates & availability</h2>
          <p className={styles.muted}>
            Districts without an override use your standard fee. Disable
            delivery to a district to prevent checkout for that destination.
            Free-delivery offers never override an unavailable district.
          </p>
          <div className={styles.rules}>
            {rules.map((r, i) => (
              <div className={styles.rule} key={r.district}>
                <label>
                  District
                  <select
                    value={r.district}
                    onChange={(e) =>
                      setRules((old) =>
                        old.map((v, n) =>
                          n === i ? { ...v, district: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    {deliveryDistricts
                      .filter(
                        (d) =>
                          d === r.district ||
                          !rules.some((v) => v.district === d),
                      )
                      .map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Delivery
                  <select
                    value={r.available ? "YES" : "NO"}
                    onChange={(e) =>
                      setRules((old) =>
                        old.map((v, n) =>
                          n === i
                            ? { ...v, available: e.target.value === "YES" }
                            : v,
                        ),
                      )
                    }
                  >
                    <option value="YES">Available</option>
                    <option value="NO">Not available</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() =>
                    setRules((old) => old.filter((_, n) => n !== i))
                  }
                  aria-label={`Remove ${r.district} override`}
                >
                  <Trash2 size={17} />
                </button>
                <label>
                  District fee (LKR)
                  <input
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) =>
                      setRules((old) =>
                        old.map((v, n) =>
                          n === i ? { ...v, amount: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="outline-btn"
            disabled={rules.length >= 25}
            onClick={() => {
              const district = deliveryDistricts.find(
                (d) => !rules.some((r) => r.district === d),
              );
              if (district)
                setRules((old) => [
                  ...old,
                  {
                    district,
                    available: true,
                    feeMinor: 0,
                    amount: fee || "0.00",
                  },
                ]);
            }}
          >
            <Plus size={16} /> Add district override
          </button>
        </section>
        <div className={styles.toolbar}>
          <button className="primary-btn" type="submit">
            {busy ? "Saving…" : "Save delivery settings"}
          </button>
          <span className={styles.muted}>
            Changes apply to future checkouts.
          </span>
        </div>
      </fieldset>
      {isPreview && (
        <p className={styles.muted}>
          Design preview. Connect the API to save your real delivery settings.
        </p>
      )}
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
