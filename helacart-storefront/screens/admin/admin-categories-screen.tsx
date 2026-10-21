"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from "react";
import { FolderTree, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { previewCategories } from "@/lib/admin";
import { pageOf, type Page } from "@/lib/shops";
import type { ManagedCategory } from "@/lib/storefront-content";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import {
  AdminDecision,
  AdminEmpty,
  AdminFeedback,
  AdminHeading,
} from "@/components/admin-ui";
import { AdminImageEditor } from "@/components/admin-image-editor";
import { ListPagination, useDebounced } from "@/components/list-controls";
import s from "@/components/content-management.module.css";
const samples: ManagedCategory[] = previewCategories.map((category) => ({
  ...category,
  description: null,
  imageUrl: null,
  isActive: true,
  sortOrder: 0,
  revision: 0,
  _count: { products: 2 },
}));
type Availability = "all" | "active" | "archived";
export default function AdminCategoriesPage() {
  const { isPreview } = useAdmin();
  const [query, setQuery] = useState(""),
    [availability, setAvailability] = useState<Availability>("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<ManagedCategory | null>(null),
    [epoch, setEpoch] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const q = useDebounced(query);
  const search = new URLSearchParams({ q, availability, page: String(page) });
  const resource = useAdminResource<Page<ManagedCategory>>(
    `/admin/categories?${search}`,
    pageOf(
      samples.filter(
        (row) =>
          (availability === "all" ||
            row.isActive === (availability === "active")) &&
          row.name.toLowerCase().includes(q.toLowerCase()),
      ),
      page,
      20,
    ),
  );
  return (
    <>
      <AdminHeading
        eyebrow="CATALOG / TAXONOMY"
        title="Categories"
        description="Manage category details, images and availability. Existing category links stay the same."
        action={
          <button
            className="outline-btn"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setEpoch((value) => value + 1);
            }}
          >
            <Plus size={16} />
            Add category
          </button>
        }
      />
      <AdminFeedback error={resource.error} notice={notice} />
      <div className={s.layout}>
        <CategoryForm
          key={`${selected?.id || "new"}:${epoch}`}
          category={selected}
          isPreview={isPreview}
          onBusy={setBusy}
          onChange={() => resource.reload()}
          onNotice={setNotice}
          onCreated={(row) => {
            setSelected(row);
            setEpoch((value) => value + 1);
            resource.reload();
          }}
          onDeleted={() => {
            setSelected(null);
            setEpoch((value) => value + 1);
            resource.reload();
          }}
        />
        <section className={`admin-card ${s.list}`}>
          <div className="admin-card-head">
            <div>
              <h2>All categories</h2>
              <p>{resource.data?.total ?? "—"} matching categories</p>
            </div>
            <button
              className="admin-link-button"
              onClick={resource.reload}
              disabled={busy}
            >
              <RefreshCw size={15} />
              Reload
            </button>
          </div>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={16} />
              <input
                aria-label="Search categories"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search category name or slug"
                maxLength={80}
              />
            </label>
            <select
              aria-label="Category availability"
              value={availability}
              onChange={(event) => {
                setAvailability(event.target.value as Availability);
                setPage(1);
              }}
            >
              <option value="all">All categories</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {resource.loading ? (
            <AdminEmpty message="Loading categories…" />
          ) : resource.data?.items.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Products</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={s.categoryCell}>
                          <span className={s.thumb}>
                            {row.imageUrl ? (
                              <img src={row.imageUrl} alt="" />
                            ) : (
                              <FolderTree size={20} />
                            )}
                          </span>
                          <span>
                            <strong>{row.name}</strong>
                            <small>{row.slug}</small>
                          </span>
                        </div>
                      </td>
                      <td>{row._count.products}</td>
                      <td>{row.sortOrder}</td>
                      <td>
                        <span
                          className={`admin-badge ${row.isActive ? "good" : "neutral"}`}
                        >
                          {row.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-link-button"
                          disabled={busy}
                          onClick={() => {
                            setSelected(row);
                            setEpoch((value) => value + 1);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmpty
              message={
                resource.error
                  ? "Could not load categories."
                  : "No categories match your search."
              }
            />
          )}
          <ListPagination
            data={resource.data}
            onPage={setPage}
            loading={resource.loading}
            label="Category pages"
          />
        </section>
      </div>
    </>
  );
}
function CategoryForm({
  category,
  isPreview,
  onBusy,
  onChange,
  onCreated,
  onDeleted,
  onNotice,
}: {
  category: ManagedCategory | null;
  isPreview: boolean;
  onBusy: (value: boolean) => void;
  onChange: () => void;
  onCreated: (row: ManagedCategory) => void;
  onDeleted: () => void;
  onNotice: (message: string) => void;
}) {
  const { request } = useAdmin();
  const [current, setCurrent] = useState(category),
    [name, setName] = useState(category?.name || ""),
    [slug, setSlug] = useState(category?.slug || ""),
    [slugEdited, setSlugEdited] = useState(false),
    [description, setDescription] = useState(category?.description || ""),
    [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0),
    [isActive, setIsActive] = useState(category?.isActive ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [decision, setDecision] = useState<"availability" | "delete" | null>(null);
  function loading(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  async function save() {
    loading(true);
    setError("");
    try {
      if (!current) {
        const created = await request<ManagedCategory>(
          "/admin/categories",
          "POST",
          {
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            sortOrder,
          },
        );
        onNotice("Category created. You can now add its image.");
        onCreated({ ...created, _count: { products: 0 } });
      } else {
        const row = await request<ManagedCategory>(
          `/admin/categories/${current.id}`,
          "PATCH",
          {
            name: name.trim(),
            description: description.trim(),
            sortOrder,
            isActive,
            expectedRevision: current.revision,
          },
        );
        setCurrent(row);
        onChange();
        onNotice(
          row.isActive
            ? "Category saved."
            : "Category archived. Its products are hidden from the storefront.",
        );
      }
    } finally {
      loading(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (current && current.isActive !== isActive) {
      setDecision("availability");
      return;
    }
    try {
      await save();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  async function image(file?: File) {
    if (!current) return;
    loading(true);
    try {
      const row = await request<ManagedCategory>(
        `/admin/categories/${current.id}/image${file ? `?expectedRevision=${current.revision}` : ""}`,
        file ? "POST" : "DELETE",
        file || { expectedRevision: current.revision },
      );
      setCurrent(row);
      onChange();
      onNotice(
        file
          ? "Category image updated."
          : "Category image removed. The category icon will appear instead.",
      );
    } finally {
      loading(false);
    }
  }
  return (
    <section id="category-editor" className={`admin-card ${s.form}`}>
      <h2>{current ? "Edit category" : "Add a category"}</h2>
      <p>
        {current
          ? "Update the category while keeping its existing links."
          : "Create a category, then upload an optional photo or illustration."}
      </p>
      <AdminFeedback error={error} />
      <form onSubmit={(event) => void submit(event)}>
        <fieldset
          disabled={busy || isPreview}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <label>
            Category name
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              autoFocus={Boolean(category)}
              onChange={(event) => {
                setName(event.target.value);
                if (!current && !slugEdited)
                  setSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
              }}
            />
          </label>
          <label>
            URL slug
            <input
              required
              minLength={2}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              readOnly={!!current}
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
            />
            <small>
              {current
                ? "Kept unchanged so existing category links continue to work."
                : "Lowercase letters, numbers and single hyphens."}
            </small>
          </label>
          <label>
            Description
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Display order
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              required
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
            />
            <small>Lower numbers appear first.</small>
          </label>
          {current && (
            <label className={s.check}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                Active category
                <small style={{ display: "block" }}>
                  Archived categories and their products are hidden from
                  shoppers and new seller listings.
                </small>
              </span>
            </label>
          )}
          <div className={s.actions}>
            <button className="primary-btn" type="submit">
              {busy ? "Saving…" : current ? "Save changes" : "Create category"}
            </button>
            {current && (
              <button
                type="button"
                className="admin-danger-outline"
                disabled={current._count.products > 0}
                onClick={() => setDecision("delete")}
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {current && (
        <>
          <p className={s.status}>
            {current._count.products
              ? `${current._count.products} products use this category. Archive it instead of deleting it.`
              : "This category has no products and can be deleted."}
          </p>
          <AdminImageEditor
            src={current.imageUrl}
            label="Category image"
            hint="Optional square photo or illustration. JPEG, PNG or WebP, up to 5 MB. Image changes are saved immediately."
            disabled={busy || isPreview}
            onUpload={(file) => image(file)}
            onRemove={() => image()}
          />
        </>
      )}
      {isPreview && (
        <p className="admin-muted">
          Preview only. Sign in as an administrator to make changes.
        </p>
      )}
      {decision && (
        <AdminDecision
          title={
            decision === "delete"
              ? "Delete this category?"
              : isActive
                ? "Restore this category?"
                : "Archive this category?"
          }
          description={
            decision === "delete"
              ? `Permanently delete ${current?.name}? Only categories without products can be deleted.`
              : isActive
                ? "Save changes and make this category and its approved products available again?"
                : "Save changes and hide this category and its products from the storefront? Existing orders will be preserved."
          }
          label={
            decision === "delete"
              ? "Delete category"
              : isActive
                ? "Save and restore"
                : "Save and archive"
          }
          dangerous={decision === "delete" || !isActive}
          onClose={() => setDecision(null)}
          onConfirm={async () => {
            if (decision === "delete" && current) {
              loading(true);
              try {
                await request(`/admin/categories/${current.id}`, "DELETE", {
                  expectedRevision: current.revision,
                });
                onNotice("Category deleted.");
                onDeleted();
              } finally {
                loading(false);
              }
            } else await save();
          }}
        />
      )}
    </section>
  );
}
