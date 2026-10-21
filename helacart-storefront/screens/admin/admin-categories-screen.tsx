"use client";

import { useState, type FormEvent } from "react";
import { FolderTree, Plus, Search } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import { AdminEmpty, AdminFeedback, AdminHeading } from "@/components/admin-ui";
import { previewCategories, type AdminCategory } from "@/lib/admin";

export default function AdminCategoriesPage() {
  const { isPreview, request } = useAdmin();
  const resource = useAdminResource<AdminCategory[]>("/categories", previewCategories);
  const [query, setQuery] = useState(""); const [name, setName] = useState(""); const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const rows = (resource.data ?? []).filter((row) => `${row.name} ${row.slug}`.toLowerCase().includes(query.toLowerCase()));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (isPreview) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/admin/categories", "POST", { name: name.trim(), slug: slug.trim() });
      setNotice("Category created."); setName(""); setSlug(""); resource.reload();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <>
    <AdminHeading eyebrow="CATALOG / TAXONOMY" title="Categories" description="Create categories that sellers can choose for product listings." />
    <AdminFeedback error={resource.error || error} notice={notice} />
    <div className="admin-two-columns"><form className="admin-card admin-category-form" onSubmit={(event) => void submit(event)}><span className="admin-form-icon"><FolderTree size={23} /></span><h2>Add a category</h2><p>Use a clear name and a simple lowercase URL slug.</p>
      <label>Category name<input required minLength={2} maxLength={80} value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slug) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="e.g. Home & Living" /></label>
      <label>URL slug<input required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="home-living" /><small>Only lowercase letters, numbers and single hyphens.</small></label>
      <button className="primary-btn" type="submit" disabled={busy || isPreview}><Plus size={17} /> {busy ? "Creating…" : "Create category"}</button>
      {isPreview && <p className="admin-muted">Sign in with an authorized admin account to create categories.</p>}
    </form>
      <section className="admin-card"><div className="admin-card-head"><div><h2>Active categories</h2><p>Categories returned by the public catalog API</p></div><span className="admin-count-pill">{resource.data?.length ?? "…"} total</span></div>
        <div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input aria-label="Search loaded categories" placeholder="Search name or slug" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        {resource.loading ? <AdminEmpty message="Loading categories…" /> : rows.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Category</th><th>Slug</th><th>Availability</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.slug}</td><td><span className="admin-badge good">Active</span></td></tr>)}</tbody></table></div> : <AdminEmpty message={resource.error ? "Could not load categories." : "No categories match the search."} />}
      </section>
    </div>
  </>;
}
