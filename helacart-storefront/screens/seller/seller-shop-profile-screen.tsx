"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiBase, errorMessage } from "@/lib/api";
import { previewShops, shopPath, type PrivateShop } from "@/lib/shops";
import { ShieldCheck, Store } from "lucide-react";
import { initials } from "@/lib/profile";
import { AccountSecurity } from "@/components/account-security";
import { ShopBusinessProfile } from "@/components/shop-business-profile";
import p from "@/components/profile.module.css";
import { useShop } from "@/components/shop-provider";
import { useSeller } from "@/components/seller-provider";
import { SellerPageHeading } from "@/components/seller-ui";
import s from "@/components/shop.module.css";

export default function SellerShopPage() {
  const { seller, request, isPreview, refreshProfile } = useSeller();
  const { user } = useShop();
  const identityKey = `${user?.uid}:${seller?.id}`;
  const [tab, setTab] = useState<"public" | "business" | "security">("public");
  const [state, setState] = useState<{
    id: string;
    shop: PrivateShop | null;
    error: string;
  }>({ id: "", shop: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!seller || isPreview) return;
    let active = true;
    request<PrivateShop>(`/sellers/${seller.id}/shop`)
      .then((shop) => {
        if (active) setState({ id: identityKey, shop, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({ id: identityKey, shop: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [seller, request, isPreview, attempt, identityKey]);
  const shop = isPreview
    ? { ...(previewShops.find((row) => row.slug === seller?.slug) ?? previewShops[0]), status: "APPROVED" as const, contactPhone: "+94 77 123 4567", pickupAddress: "12 Temple Road, Kandy, Sri Lanka", identityDocumentType: "NATIONAL_ID" as const, documents: [] }
    : state.id === identityKey
      ? state.shop
      : null;
  return (
    <>
      <SellerPageHeading
        kicker="YOUR SHOP IDENTITY"
        title="Shop profile"
        description="Manage your shop's public appearance, private business details and account security."
        action={
          shop && (
            <Link className="outline-btn" href={shopPath(shop)}>
              View public shop
            </Link>
          )
        }
      />
      {shop && <>
        <div className={p.shopBanner}>{shop.logoUrl ? <img src={shop.logoUrl} alt="Shop logo" /> : <span className={p.avatar}>{initials(shop.name)}</span>}<div><h2>{shop.name}</h2><p>{shop.publicLocation || "Add your shop's town or district"}</p></div><span className={p.badge}><ShieldCheck size={14} />Approved shop</span></div>
        <div className={p.tabs} role="tablist" aria-label="Shop profile sections">{([ ["public", "Public shop"], ["business", "Business details"], ["security", "Login & security"] ] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? p.activeTab : ""} onClick={() => setTab(value)}>{value === "public" && <Store size={16} />}{label}</button>)}</div>
      </>}
      {!shop ? (
        state.error ? (
          <div className={s.notice} role="alert">
            {state.error}{" "}
            <button onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <div className="seller-state">Loading shop profile…</div>
        )
      ) : tab === "business" ? <ShopBusinessProfile key={identityKey} shop={shop} /> : tab === "security" ? <AccountSecurity previewEmail="shop@example.com" /> : (
        <ShopForm
          key={identityKey}
          shop={shop}
          sellerId={seller?.id ?? ""}
          request={request}
          refreshProfile={refreshProfile}
          isPreview={isPreview}
        />
      )}
    </>
  );
}
function ShopForm({
  shop,
  sellerId,
  request,
  refreshProfile,
  isPreview,
}: {
  shop: PrivateShop;
  sellerId: string;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  refreshProfile: () => Promise<void>;
  isPreview: boolean;
}) {
  const { user } = useShop();
  const [name, setName] = useState(shop.name),
    [description, setDescription] = useState(shop.description ?? ""),
    [location, setLocation] = useState(shop.publicLocation ?? "");
  const [images, setImages] = useState({
      logo: shop.logoUrl,
      cover: shop.coverUrl,
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await request(`/sellers/${sellerId}/shop`, "PATCH", {
        name,
        description,
        publicLocation: location,
      });
      await refreshProfile();
      setNotice(
        "Shop profile saved. Shoppers can see the updated information.",
      );
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function image(kind: "logo" | "cover", file: File | null) {
    if (!user || isPreview) return;
    setBusy(true);
    setNotice("");
    try {
      if (!file) {
        await request(`/sellers/${sellerId}/shop/images/${kind}`, "DELETE");
        setImages((previous) => ({ ...previous, [kind]: null }));
      } else {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Choose a JPEG, PNG or WebP image up to 5 MB.");
        const response = await fetch(
          `${apiBase}/sellers/${sellerId}/shop/images/${kind}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await user.getIdToken()}`,
              "Content-Type": file.type,
            },
            body: file,
            signal: AbortSignal.timeout(60000),
          },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            Array.isArray(payload.message)
              ? payload.message.join("; ")
              : payload.message || "Image upload failed.",
          );
        setImages((previous) => ({ ...previous, [kind]: payload.imageUrl }));
      }
      await refreshProfile();
      setNotice(`${kind === "logo" ? "Logo" : "Cover image"} updated.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="seller-settings-grid">
      <form
        className={`seller-card seller-form ${s.profileForm}`}
        onSubmit={(event) => void save(event)}
      >
        <div className="seller-card-heading">
          <div>
            <h2>Shop profile</h2>
            <p>Public information shoppers see on your shop</p>
          </div>
        </div>
        {notice && (
          <div className={s.notice} role="status">
            {notice}
          </div>
        )}
        <label>
          Shop name
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          About your shop
          <textarea
            rows={6}
            maxLength={1000}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tell shoppers what makes your collection special."
          />
        </label>
        <label>
          Public location
          <input
            maxLength={80}
            value={location}
            disabled={busy}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Kandy, Sri Lanka"
          />
        </label>
        <p className="seller-muted">
          Add your town or district. Your pickup address and identity documents
          stay private.
        </p>
        <div className="seller-form-actions">
          <button className="primary-btn" disabled={busy || isPreview}>
            {busy ? "Saving…" : "Save shop profile"}
          </button>
        </div>
        <p className="seller-muted">
          Shop link: <Link href={shopPath(shop)}>{shopPath(shop)}</Link>
        </p>
      </form>
      <div className="seller-card seller-form">
        <div className="seller-card-heading">
          <div>
            <h2>Logo & cover</h2>
            <p>JPEG, PNG or WebP · Up to 5 MB each</p>
          </div>
        </div>
        <div className={s.imageEditor}>
          {(["logo", "cover"] as const).map((kind) => (
            <div className={s.imageSlot} key={kind}>
              <strong>{kind === "logo" ? "Shop logo" : "Cover photo"}</strong>
              {images[kind] ? (
                <img src={images[kind]!} alt={`Current shop ${kind}`} />
              ) : (
                <div className={s.empty}>
                  {kind === "logo"
                    ? "Your initials appear here"
                    : "A green banner appears by default"}
                </div>
              )}
              <small>
                {kind === "logo"
                  ? "Recommended: square image"
                  : "Recommended: wide image, 1600 × 400"}
              </small>
              <label className="seller-muted">
                Upload {kind}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy || isPreview}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void image(kind, file);
                    event.target.value = "";
                  }}
                />
              </label>
              {images[kind] && (
                <button
                  className={s.textButton}
                  disabled={busy || isPreview}
                  onClick={() => void image(kind, null)}
                >
                  Remove {kind}
                </button>
              )}
            </div>
          ))}
        </div>
        {isPreview && (
          <p className="seller-muted">
            Connect the API to save your real shop profile and images.
          </p>
        )}
      </div>
    </div>
  );
}
