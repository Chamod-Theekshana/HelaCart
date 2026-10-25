"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Star, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  pageOf,
  previewReviews,
  shopDate,
  shopPath,
  type PublicShop,
  type ReviewAccess,
  type ReviewsPage,
  type ShopReview,
} from "@/lib/shops";
import { useShop } from "./shop-provider";
import { Stars } from "./shop-ui";
import s from "./shop.module.css";
import p from "./review-photos.module.css";
import { ReviewPhotos, reviewPhotoUrl } from "./review-photos";

export function ShopReviews({
  shop,
  initial,
}: {
  shop: PublicShop;
  initial: ReviewsPage | null;
}) {
  const { user, isPreview } = useShop();
  const router = useRouter();
  const [sort, setSort] = useState("newest"),
    [rating, setRating] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const key = `${page}:${sort}:${rating}:${revision}`;
  const [feed, setFeed] = useState<{
    key: string;
    data: ReviewsPage | null;
    error: string;
  }>({
    key: "1:newest::0",
    data: initial,
    error: initial ? "" : "Reviews could not be loaded.",
  });
  const [accessState, setAccess] = useState<{
    key: string;
    data: ReviewAccess | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const [notice, setNotice] = useState("");
  const accessKey = `${user?.uid ?? ""}:${user?.emailVerified}:${revision}`;
  useEffect(() => {
    if (key === "1:newest::0" && initial) return;
    let active = true;
    const query = new URLSearchParams({ sort, page: String(page) });
    if (rating) query.set("rating", rating);
    let task: Promise<ReviewsPage>;
    if (isPreview) {
      const rows = previewReviews
        .filter((row) => !rating || row.rating === Number(rating))
        .toSorted((a, b) =>
          sort === "highest"
            ? b.rating - a.rating
            : sort === "lowest"
              ? a.rating - b.rating
              : b.createdAt.localeCompare(a.createdAt),
        );
      task = Promise.resolve({ ...pageOf(rows, page), summary: shop.rating });
    } else
      task = api<ReviewsPage>(
        `/shops/${encodeURIComponent(shop.slug)}/reviews?${query}`,
      );
    task
      .then((data) => {
        if (active) setFeed({ key, data, error: "" });
      })
      .catch((error) => {
        if (active) setFeed({ key, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [key, initial, isPreview, page, rating, sort, shop.slug, shop.rating]);
  useEffect(() => {
    if (!user?.emailVerified || isPreview) return;
    let active = true;
    user
      .getIdToken()
      .then((token) =>
        api<ReviewAccess>(
          `/shops/${encodeURIComponent(shop.slug)}/review-access`,
          { token },
        ),
      )
      .then((data) => {
        if (active) setAccess({ key: accessKey, data, error: "" });
      })
      .catch((error) => {
        if (active)
          setAccess({ key: accessKey, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [user, isPreview, shop.slug, accessKey]);
  const data = feed.key === key ? feed.data : null;
  const access =
    !isPreview && user?.emailVerified && accessState.key === accessKey
      ? accessState.data
      : null;
  const summary = data?.summary ?? initial?.summary ?? shop.rating;
  async function request(path: string, method: string, body?: unknown) {
    if (!user || isPreview) throw new Error("Sign in to manage reviews.");
    await api(path, { method, body, token: await user.getIdToken() });
  }
  function changed(message: string) {
    setNotice(message);
    setRevision((value) => value + 1);
    router.refresh();
  }
  return (
    <section id="reviews" className={s.section}>
      <div className={s.sectionHeading}>
        <div>
          <h2>What shoppers are saying</h2>
          <p>Real experiences from delivered orders.</p>
        </div>
      </div>
      <div className={s.reviewLayout}>
        <aside className={s.summary}>
          <h3>Customer reviews</h3>
          <strong className={s.bigRating}>
            {summary.total ? summary.average.toFixed(1) : "—"}
            <small> / 5</small>
          </strong>
          <Stars rating={summary.average} />
          <small>
            {summary.total} verified buyer{" "}
            {summary.total === 1 ? "review" : "reviews"}
          </small>
          <div className={s.bars}>
            {summary.breakdown.map((row) => (
              <div className={s.bar} key={row.rating}>
                <span>{row.rating}</span>
                <Star size={11} fill="currentColor" />
                <meter
                  min={0}
                  max={Math.max(summary.total, 1)}
                  value={row.count}
                  aria-label={`${row.rating} stars: ${row.count} reviews`}
                />
                <span>{row.count}</span>
              </div>
            ))}
          </div>
          <small>One review per delivered order.</small>
        </aside>
        <div className={s.reviewMain}>
          {notice && (
            <div className={s.notice} role="status">
              {notice}
            </div>
          )}
          {isPreview ? (
            <div className={s.notice}>
              Sample reviews for design preview. Connect the API and sign in to
              write a review.
            </div>
          ) : !user ? (
            <div className={s.notice}>
              Bought something from this shop?{" "}
              <Link
                className="text-link"
                href={`/auth?next=${encodeURIComponent(`${shopPath(shop)}#reviews`)}`}
              >
                Sign in to leave a review
              </Link>
            </div>
          ) : !user.emailVerified ? (
            <div className={s.notice}>
              <Link href="/auth">Verify your email</Link> to write a review or
              report one.
            </div>
          ) : accessState.key !== accessKey ? (
            <div className={s.notice} role="status">
              Checking your delivered orders…
            </div>
          ) : accessState.error ? (
            <div className={s.notice} role="alert">
              {accessState.error}{" "}
              <button
                className={s.textButton}
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : access?.canReply ? (
            <div className={s.notice}>
              You are viewing your shop. You can reply to your customers below.
            </div>
          ) : access ? (
            <ReviewEditor
              key={accessKey}
              access={access}
              slug={shop.slug}
              request={request}
              onSaved={changed}
            />
          ) : null}
          <div className={s.reviewFilters}>
            <label>
              Show
              <select
                value={rating}
                onChange={(event) => {
                  setRating(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} stars
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest first</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </label>
          </div>
          {feed.key !== key ? (
            <div className={s.empty} role="status">
              Loading reviews…
            </div>
          ) : feed.error ? (
            <div className={s.notice} role="alert">
              {feed.error}{" "}
              <button
                className={s.textButton}
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : data?.items.length ? (
            data.items.map((review) => (
              <ReviewRow
                key={`${review.id}:${revision}:${user?.uid}`}
                review={review}
                shop={shop}
                canReply={Boolean(access?.canReply)}
                canReport={Boolean(user?.emailVerified && !isPreview)}
                own={Boolean(
                  access?.myReviews.some((row) => row.id === review.id),
                )}
                request={request}
                onSaved={changed}
              />
            ))
          ) : (
            <div className={s.empty}>
              {rating
                ? "No reviews with this rating yet."
                : "No reviews yet. Your experience could help the next shopper."}
            </div>
          )}
          {data && data.pages > 1 && (
            <nav className={s.pagination} aria-label="Review pagination">
              <button
                className="outline-btn"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                {page} / {data.pages}
              </span>
              <button
                className="outline-btn"
                disabled={page >= data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
type Mutation = (path: string, method: string, body?: unknown) => Promise<void>;
function ReviewEditor({
  access,
  slug,
  request,
  onSaved,
}: {
  access: ReviewAccess;
  slug: string;
  request: Mutation;
  onSaved: (message: string) => void;
}) {
  const [orderId, setOrderId] = useState(
    access.orders.find(
      (row) =>
        !row.shopReview ||
        (row.shopReview.deletedAt && !row.shopReview.isHidden),
    )?.id ??
      access.orders[0]?.id ??
      "",
  );
  const chosen = access.orders.find((row) => row.id === orderId);
  const [rating, setRating] = useState(chosen?.shopReview?.rating ?? 5),
    [comment, setComment] = useState(
      chosen?.shopReview && !chosen.shopReview.deletedAt
        ? chosen.shopReview.comment
        : "",
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const hidden = Boolean(chosen?.shopReview?.isHidden);
  const [keptPhotos, setKeptPhotos] = useState(
    chosen?.shopReview && !chosen.shopReview.deletedAt
      ? (chosen.shopReview.photos ?? [])
      : [],
  );
  const [newPhotos, setNewPhotos] = useState<
    { id: string; file: File; url: string }[]
  >([]);
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  function clearNewPhotos() {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
    setNewPhotos([]);
  }
  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    if (files.length + newPhotos.length + keptPhotos.length > 3) {
      setError(
        "Add at most 3 photos per review. Remove a photo to choose another.",
      );
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size === 0 ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      setError("Choose JPEG, PNG or WebP photos up to 5 MB each.");
      return;
    }
    const additions = files.map((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setNewPhotos((previous) => [...previous, ...additions]);
  }
  const existing =
    chosen?.shopReview && !chosen.shopReview.deletedAt
      ? chosen.shopReview
      : null;
  function choose(id: string) {
    setOrderId(id);
    const review = access.orders.find((row) => row.id === id)?.shopReview;
    setRating(review?.rating ?? 5);
    setComment(review && !review.deletedAt ? review.comment : "");
    setKeptPhotos(review && !review.deletedAt ? (review.photos ?? []) : []);
    clearNewPhotos();
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("rating", String(rating));
      form.set("comment", comment);
      form.set(
        "keepPhotoIds",
        JSON.stringify(keptPhotos.map((photo) => photo.id)),
      );
      for (const photo of newPhotos) form.append("photos", photo.file);
      await request(
        `/shops/${encodeURIComponent(slug)}/reviews/${orderId}`,
        "PUT",
        form,
      );
      onSaved(
        existing
          ? "Your review has been updated."
          : "Thank you! Your review is now visible on this shop.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await request(
        `/shops/${encodeURIComponent(slug)}/reviews/${id}`,
        "DELETE",
      );
      onSaved("Your review has been deleted.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (!access.orders.length && !access.myReviews.length)
    return (
      <div className={s.notice}>
        You can review this shop after your order has been delivered.
      </div>
    );
  return (
    <>
      <form className={s.form} onSubmit={(event) => void save(event)}>
        <h3>{existing ? "Your review" : "Share your experience"}</h3>
        <p>
          Your profile name will appear with your review. One review per
          delivered order; choose an order to write or edit it.
        </p>
        {access.orders.length > 0 && (
          <label>
            Delivered order
            <select
              value={orderId}
              disabled={busy}
              onChange={(event) => choose(event.target.value)}
            >
              {access.orders.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.id.slice(0, 8).toUpperCase()} ·{" "}
                  {shopDate(row.createdAt)}
                  {row.shopReview && !row.shopReview.deletedAt
                    ? " · Reviewed"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {hidden ? (
          <div className={s.notice}>
            This review was hidden by moderation and cannot be edited or
            reposted.
          </div>
        ) : (
          chosen && (
            <>
              <fieldset
                style={{ border: 0, padding: 0, margin: 0 }}
                disabled={busy}
              >
                <legend style={{ fontSize: 12, marginBottom: 5 }}>
                  Your rating
                </legend>
                <div className={s.starPicker}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={rating === value}
                      aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                      onClick={() => setRating(value)}
                    >
                      <Star
                        size={25}
                        fill={value <= rating ? "currentColor" : "none"}
                      />
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
                  value={comment}
                  disabled={busy}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="How was your experience with this shop?"
                />
              </label>
              <div className={p.picker}>
                <strong>
                  Photos (optional) · {keptPhotos.length + newPhotos.length}/3
                </strong>
                <p>
                  Show what you received. JPEG, PNG or WebP, up to 5 MB each.
                  Photos are public with your review.
                </p>
                <div className={p.drafts}>
                  {keptPhotos.map((photo, index) => (
                    <div key={photo.id} className={p.draft}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={reviewPhotoUrl(slug, existing?.id ?? "", photo.id)}
                        alt={`Attached review photo ${index + 1}`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove attached photo ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          setKeptPhotos((previous) =>
                            previous.filter((row) => row.id !== photo.id),
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                      <small>Attached</small>
                    </div>
                  ))}
                  {newPhotos.map((photo, index) => (
                    <div key={photo.id} className={p.draft}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`New review photo ${index + 1}`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove new photo ${index + 1}`}
                        disabled={busy}
                        onClick={() => {
                          URL.revokeObjectURL(photo.url);
                          previewUrls.current.delete(photo.url);
                          setNewPhotos((previous) =>
                            previous.filter((row) => row.id !== photo.id),
                          );
                        }}
                      >
                        <X size={15} />
                      </button>
                      <small>New photo</small>
                    </div>
                  ))}
                </div>
                <label className={p.uploadLabel}>
                  Add review photos
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || keptPhotos.length + newPhotos.length >= 3}
                    onChange={addPhotos}
                  />
                </label>
                <p>
                  Photo changes are saved when you post or update your review.
                </p>
              </div>
              <div className={s.formFooter}>
                <button
                  className="primary-btn"
                  disabled={busy || comment.trim().length < 10}
                >
                  {busy
                    ? "Saving…"
                    : existing
                      ? "Update review"
                      : "Post review"}
                </button>
                {existing && (
                  <button
                    type="button"
                    className={s.textButton}
                    disabled={busy}
                    onClick={() => void remove(existing.id)}
                  >
                    Delete review
                  </button>
                )}
                <span>{comment.length}/1500</span>
              </div>
            </>
          )
        )}
        {hidden && existing && (
          <button
            type="button"
            className={s.textButton}
            disabled={busy}
            onClick={() => void remove(existing.id)}
          >
            Delete your review
          </button>
        )}
        {error && (
          <div role="alert" className={s.notice}>
            {error}
          </div>
        )}
      </form>
      {access.myReviews
        .filter(
          (row) =>
            !access.orders.some((order) => order.shopReview?.id === row.id),
        )
        .map((row) => (
          <div key={row.id} className={s.notice}>
            <Stars rating={row.rating} />
            <p>{row.comment}</p>
            <button
              type="button"
              disabled={busy}
              className={s.textButton}
              onClick={() => void remove(row.id)}
            >
              Delete review
            </button>
          </div>
        ))}
    </>
  );
}
function ReviewRow({
  review,
  shop,
  canReply,
  canReport,
  own,
  request,
  onSaved,
}: {
  review: ShopReview;
  shop: PublicShop;
  canReply: boolean;
  canReport: boolean;
  own: boolean;
  request: Mutation;
  onSaved: (message: string) => void;
}) {
  const [mode, setMode] = useState<"reply" | "report" | null>(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "reply")
        await request(`/sellers/${shop.id}/reviews/${review.id}/reply`, "PUT", {
          reply: text,
        });
      else
        await request(
          `/shops/${encodeURIComponent(shop.slug)}/reviews/${review.id}/report`,
          "POST",
          { reason: text },
        );
      setMode(null);
      onSaved(
        mode === "reply"
          ? "Your reply has been saved."
          : "Report sent to the HelaCart team for review.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function removeReply() {
    setBusy(true);
    setError("");
    try {
      await request(`/sellers/${shop.id}/reviews/${review.id}/reply`, "DELETE");
      onSaved("Reply removed.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={s.review}>
      <div className={s.reviewTop}>
        <div className={s.buyer}>
          <span className={s.avatar}>
            {review.buyerName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>
              {review.buyerName}
              {own ? " (you)" : ""}
            </strong>
            <span className={s.verified}>
              <BadgeCheck size={12} /> Verified purchase
            </span>
          </div>
        </div>
        <time dateTime={review.createdAt}>{shopDate(review.createdAt)}</time>
      </div>
      <div className={s.reviewStars}>
        <Stars rating={review.rating} />
      </div>
      <p>{review.comment}</p>
      <ReviewPhotos
        photos={(review.photos ?? []).map((photo) => ({
          id: photo.id,
          src: reviewPhotoUrl(shop.slug, review.id, photo.id),
        }))}
      />
      {review.reply && (
        <div className={s.reply}>
          <strong>
            {shop.name} replied
            {review.repliedAt ? ` · ${shopDate(review.repliedAt)}` : ""}
          </strong>
          <p>{review.reply}</p>
        </div>
      )}
      <div className={s.reviewActions}>
        {canReply && (
          <>
            <button
              className={s.textButton}
              disabled={busy}
              onClick={() => {
                setMode("reply");
                setText(review.reply ?? "");
                setError("");
              }}
            >
              {review.reply ? "Edit reply" : "Reply to customer"}
            </button>
            {review.reply && (
              <button
                className={s.textButton}
                disabled={busy}
                onClick={() => void removeReply()}
              >
                Remove reply
              </button>
            )}
          </>
        )}
        {canReport && !own && (
          <button
            className={s.textButton}
            onClick={() => {
              setMode("report");
              setText("");
              setError("");
            }}
          >
            Report review
          </button>
        )}
      </div>
      {mode && (
        <form className={s.form} onSubmit={(event) => void submit(event)}>
          <h3>
            {mode === "reply" ? "Reply as the shop" : "Report this review"}
          </h3>
          <p>
            {mode === "report"
              ? "Explain the issue. Your report goes privately to the HelaCart team."
              : "Your response will appear publicly below this review."}
          </p>
          <label>
            {mode === "reply" ? "Your reply" : "Reason"}
            <textarea
              required
              minLength={mode === "reply" ? 2 : 10}
              maxLength={mode === "reply" ? 1500 : 500}
              value={text}
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className={s.formFooter}>
            <button
              className="primary-btn"
              disabled={
                busy || text.trim().length < (mode === "reply" ? 2 : 10)
              }
            >
              {busy
                ? "Saving…"
                : mode === "reply"
                  ? "Save reply"
                  : "Send report"}
            </button>
            <button
              type="button"
              className={s.textButton}
              onClick={() => {
                setMode(null);
                setError("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <div className={s.notice} role="alert">
          {error}
        </div>
      )}
    </article>
  );
}
