"use client";
import { useState, type FormEvent } from "react";
import { Eye, Monitor, RefreshCw, Smartphone, Upload } from "lucide-react";
import { errorMessage } from "@/lib/api";
import {
  previewHeroState,
  type HeroAdminState,
  type HeroContent,
} from "@/lib/storefront-content";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import {
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import { AdminImageEditor } from "@/components/admin-image-editor";
import { StorefrontHero } from "@/components/storefront-hero";
import s from "@/components/content-management.module.css";
export default function AdminStorefrontAppearancePage() {
  const resource = useAdminResource<HeroAdminState>(
    "/admin/storefront/hero",
    previewHeroState,
  );
  const [epoch, setEpoch] = useState(0);
  return (
    <>
      <AdminHeading
        eyebrow="STOREFRONT / APPEARANCE"
        title="Storefront appearance"
        description="Edit the homepage hero, preview it and publish when it is ready."
      />
      <AdminFeedback error={resource.error} />
      {resource.data ? (
        <HeroEditor
          key={epoch}
          initial={resource.data}
          onReload={() => {
            resource.reload();
            setEpoch((value) => value + 1);
          }}
        />
      ) : (
        <AdminEmpty
          message={
            resource.error
              ? "Could not load the hero editor."
              : "Loading storefront appearance…"
          }
        />
      )}
    </>
  );
}
function HeroEditor({
  initial,
  onReload,
}: {
  initial: HeroAdminState;
  onReload: () => void;
}) {
  const { isPreview, request } = useAdmin();
  const [state, setState] = useState(initial),
    [draft, setDraft] = useState<HeroContent>(initial.draft),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop"),
    [showPublished, setShowPublished] = useState(false),
    [publish, setPublish] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.draft);
  const unpublished = JSON.stringify(draft) !== JSON.stringify(state.published);
  function field(key: keyof HeroContent, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    const {
      desktopImageUrl: _desktop,
      mobileImageUrl: _mobile,
      ...text
    } = draft;
    void _desktop;
    void _mobile;
    const next = await request<HeroAdminState>(
      "/admin/storefront/hero",
      "PATCH",
      { ...text, expectedRevision: state.revision },
    );
    setState(next);
    setDraft(next.draft);
    return next;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await save();
      setNotice("Draft saved. The storefront has not changed yet.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function image(kind: "desktop" | "mobile", file?: File) {
    setBusy(true);
    try {
      const next = await request<HeroAdminState>(
        `/admin/storefront/hero/images/${kind}${file ? `?expectedRevision=${state.revision}` : ""}`,
        file ? "POST" : "DELETE",
        file || { expectedRevision: state.revision },
      );
      setState(next);
      setDraft((current) => ({
        ...current,
        desktopImageUrl: next.draft.desktopImageUrl,
        mobileImageUrl: next.draft.mobileImageUrl,
      }));
      setNotice(
        "Hero image saved to draft. Publish to show it on the storefront.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminFeedback error={error} notice={notice} />
      <div className={s.toolbar}>
        <button className="outline-btn" onClick={onReload} disabled={busy}>
          <RefreshCw size={15} />
          Reload saved draft
        </button>
        <span className={s.status}>
          {isPreview
            ? "Read-only design preview."
            : dirty
              ? "You have unsaved text changes."
              : unpublished
                ? "Draft changes are ready to preview and publish."
                : "The draft matches the published hero."}
          {state.publishedAt &&
            ` Last published ${new Date(state.publishedAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}.`}
        </span>
      </div>
      <section className={`admin-card ${s.form}`}>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset
            disabled={busy || isPreview}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className={s.heroForm}>
              <div>
                <h2>Hero content</h2>
                <label>
                  Eyebrow
                  <input
                    required
                    maxLength={80}
                    value={draft.eyebrow}
                    onChange={(event) => field("eyebrow", event.target.value)}
                  />
                </label>
                <label>
                  Heading
                  <input
                    required
                    maxLength={60}
                    value={draft.title}
                    onChange={(event) => field("title", event.target.value)}
                  />
                </label>
                <label>
                  Accent line
                  <input
                    maxLength={60}
                    value={draft.accent}
                    onChange={(event) => field("accent", event.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    required
                    maxLength={240}
                    rows={4}
                    value={draft.description}
                    onChange={(event) =>
                      field("description", event.target.value)
                    }
                  />
                </label>
                <div className={s.fieldGrid}>
                  <label>
                    Button label
                    <input
                      required
                      maxLength={36}
                      value={draft.buttonLabel}
                      onChange={(event) =>
                        field("buttonLabel", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Button link
                    <input
                      required
                      maxLength={200}
                      value={draft.buttonHref}
                      onChange={(event) =>
                        field("buttonHref", event.target.value)
                      }
                    />
                    <small>
                      Use a /products or /shops link, including category
                      filters.
                    </small>
                  </label>
                </div>
                <label>
                  Image description
                  <input
                    required
                    maxLength={160}
                    value={draft.imageAlt}
                    onChange={(event) => field("imageAlt", event.target.value)}
                  />
                  <small>
                    Describe the image for shoppers using a screen reader.
                  </small>
                </label>
              </div>
              <div>
                <h2>Hero images</h2>
                <p className={s.status}>
                  Keep text in the content fields so it stays readable on every
                  screen. Images are saved to the draft immediately.
                </p>
                <AdminImageEditor
                  src={draft.desktopImageUrl}
                  label="Desktop image"
                  hint="Recommended 1600 × 1200 px. JPEG, PNG or WebP, up to 5 MB. Removing it restores the original artwork."
                  disabled={busy || isPreview}
                  wide
                  onUpload={(file) => image("desktop", file)}
                  onRemove={() => image("desktop")}
                />
                <AdminImageEditor
                  src={draft.mobileImageUrl}
                  label="Mobile image"
                  hint="Recommended 900 × 700 px. Optional; falls back to the desktop image. Up to 5 MB."
                  disabled={busy || isPreview}
                  wide
                  onUpload={(file) => image("mobile", file)}
                  onRemove={() => image("mobile")}
                />
              </div>
            </div>
            <div className={s.actions}>
              <button className="outline-btn" type="submit" disabled={!dirty}>
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={!unpublished || dirty}
                onClick={() => setPublish(true)}
              >
                <Upload size={16} />
                Publish hero
              </button>
            </div>
          </fieldset>
        </form>
        <p className={s.status}>
          Save text changes before publishing. Changes become visible to
          shoppers only after publishing.
        </p>
      </section>
      <section className={s.previewPanel} aria-label="Hero preview">
        <div className={s.previewToolbar}>
          <h2>
            <Eye size={17} />{" "}
            {showPublished ? "Published hero" : "Draft preview"}
          </h2>
          <div>
            <button
              className="outline-btn"
              aria-pressed={!showPublished}
              onClick={() => setShowPublished((value) => !value)}
            >
              {showPublished ? "View draft" : "Compare published"}
            </button>
            <button
              className="outline-btn"
              aria-label="Desktop preview"
              aria-pressed={previewMode === "desktop"}
              onClick={() => setPreviewMode("desktop")}
            >
              <Monitor size={16} />
            </button>
            <button
              className="outline-btn"
              aria-label="Mobile preview"
              aria-pressed={previewMode === "mobile"}
              onClick={() => setPreviewMode("mobile")}
            >
              <Smartphone size={16} />
            </button>
          </div>
        </div>
        <div
          className={`${s.previewCanvas} ${previewMode === "mobile" ? s.mobilePreview : ""}`}
        >
          <StorefrontHero
            content={showPublished ? state.published : draft}
            preview
            previewMobile={previewMode === "mobile"}
            hasCategories={false}
          />
        </div>
      </section>
      {publish && (
        <AdminDecision
          title="Publish this hero?"
          description="Replace the homepage hero with this saved draft? Shoppers will see the new content and images when they next load the storefront."
          label="Publish hero"
          onClose={() => setPublish(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              const next = await request<HeroAdminState>(
                "/admin/storefront/hero/publish",
                "POST",
                { expectedRevision: state.revision },
              );
              setState(next);
              setDraft(next.draft);
              setNotice(
                "Hero published. The storefront now uses this content and imagery.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
