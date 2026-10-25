"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileImage, LockKeyhole } from "lucide-react";
import { apiBase, errorMessage } from "@/lib/api";
import { clientAuth } from "@/lib/firebase";
import type { IdentityDocumentType, SellerDocument } from "@/lib/seller";
import styles from "./admin-seller-documents.module.css";

const labels: Record<SellerDocument["kind"], string> = { IDENTITY_FRONT: "Identity — front", IDENTITY_BACK: "Identity — back", BUSINESS_REGISTRATION: "Business registration" };

export function AdminSellerDocuments({ sellerId, documentType, documents }: { sellerId: string; documentType: IdentityDocumentType | null; documents: SellerDocument[] }) {
  return <section className={styles.section} aria-label="Seller verification documents"><h3>Verification documents</h3>
    <p className={styles.type}>{documentType === "NATIONAL_ID" ? "National identity card" : documentType === "DRIVING_LICENCE" ? "Driving licence" : "No identity document supplied"}</p>
    <p className={styles.private}><LockKeyhole size={14} /> Private · administrator access only</p>
    {documents.length ? <div className={styles.grid}>{documents.map(document => <PrivateDocument key={document.id} sellerId={sellerId} document={document} />)}</div> : <p className="admin-muted">No photos are available for this application. Older applications may need to be submitted again with both identity photos.</p>}
    {documents.length > 0 && !documents.some(doc => doc.kind === "BUSINESS_REGISTRATION") && <p className="admin-muted">Business registration photo was not provided (optional).</p>}
  </section>;
}

function PrivateDocument({ sellerId, document }: { sellerId: string; document: SellerDocument }) {
  const [state, setState] = useState<{ url: string; error: string }>({ url: "", error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true; let url = "";
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const load = async () => {
      try {
        const user = clientAuth()?.currentUser;
        if (!user) throw new Error("Sign in as an administrator to view this photo.");
        const response = await fetch(`${apiBase}/admin/seller-applications/${encodeURIComponent(sellerId)}/documents/${encodeURIComponent(document.id)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, signal: controller.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("Could not load this photo. Check your access and try again.");
        const blob = await response.blob();
        if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("This document is not a supported image.");
        if (!active) return;
        url = URL.createObjectURL(blob); setState({ url, error: "" });
      } catch (cause) { if (active) setState({ url: "", error: errorMessage(cause) }); }
      finally { clearTimeout(timeout); }
    };
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [sellerId, document.id, attempt]);

  return <div className={styles.card}><strong>{labels[document.kind]}</strong>{state.url ? <>
    {/* Authenticated image bytes stay in a revocable local blob URL. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={state.url} alt={labels[document.kind]} />
    <a href={state.url} target="_blank" rel="noopener noreferrer">View full photo <ExternalLink size={13} /></a>
  </> : <div className={styles.placeholder}><FileImage size={25} /><span>{state.error || "Loading private photo…"}</span>{state.error && <button type="button" onClick={() => { setState({ url: "", error: "" }); setAttempt(value => value + 1); }}>Try again</button>}</div>}</div>;
}
