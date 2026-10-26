"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { PageQueryBridge } from "./page-query-bridge";
import { Plus, RefreshCw, X } from "lucide-react";
import {
  FinanceFeedback,
  FinancePager,
  useFinanceResource,
} from "./commission-workspace";
import { emptyPage, type FinanceRequest } from "@/lib/commission";
import { errorMessage } from "@/lib/api";
import { dateTime } from "@/lib/admin";
import {
  supportCategories,
  supportStatuses,
  type CaseMessage,
  type SupportCase,
} from "@/lib/after-sales";
import type { Page } from "@/lib/shops";
import styles from "./after-sales.module.css";
const sampleCase: SupportCase = {
  id: "preview-case",
  title: "Question about a delivery",
  category: "DELIVERY",
  status: "UNDER_REVIEW",
  version: 1,
  financeHold: false,
  resolution: null,
  sellerOrderId: null,
  createdAt: "2026-10-26T08:00:00Z",
  updatedAt: "2026-10-26T09:00:00Z",
  seller: { name: "HelaCraft Studio" },
  opener: { name: "Sample buyer" },
  sellerOrder: null,
  events: [],
};
const sampleMessages: CaseMessage[] = [
  {
    id: "preview-message",
    body: "Please help me confirm my order’s delivery details.",
    authorRole: "BUYER",
    createdAt: "2026-10-26T08:00:00Z",
    author: { name: "Sample buyer" },
  },
];
export function SupportWorkspace({
  root,
  role,
  request,
  isPreview,
}: {
  root: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  request: FinanceRequest;
  isPreview: boolean;
}) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [orderId, setOrderId] = useState("");
  const applyQuery = useCallback(
    (params: URLSearchParams) => {
      const id = params.get("case"),
        order = params.get("order");
      if (id) setSelected(id);
      if (order && /^[a-f0-9-]{36}$/i.test(order)) {
        setOrderId(order);
        setCreating(role !== "ADMIN");
      }
    },
    [role],
  );
  const list = useFinanceResource<Page<SupportCase>>(
    `${root}/support?page=${page}&status=${status}&q=${encodeURIComponent(q)}`,
    emptyPage([sampleCase]),
    request,
    isPreview,
    revision,
  );
  const refresh = () => setRevision((v) => v + 1);
  return (
    <div className={styles.workspace}>
      <PageQueryBridge onChange={applyQuery} />
      <div className={styles.toolbar}>
        <input
          aria-label="Search support cases"
          placeholder="Search case title"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter support status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All statuses</option>
          {supportStatuses.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="outline-btn" onClick={refresh}>
          <RefreshCw size={15} /> Refresh cases
        </button>
        {role !== "ADMIN" && (
          <button
            className="primary-btn"
            disabled={isPreview}
            onClick={() => {
              setOrderId("");
              setCreating(true);
            }}
          >
            <Plus size={16} /> Open support case
          </button>
        )}
      </div>
      <FinanceFeedback error={list.error} />
      <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.heading}>
            <h2>Support cases</h2>
            <small>{list.data?.total ?? "—"} cases</small>
          </div>
          <div className={styles.list}>
            {list.loading ? (
              <p>Loading cases…</p>
            ) : list.data?.items.length ? (
              list.data.items.map((row) => (
                <button
                  className={styles.case}
                  key={row.id}
                  aria-current={selected === row.id}
                  onClick={() => setSelected(row.id)}
                >
                  <strong>{row.title}</strong>
                  <span className={styles.badge}>
                    {row.status.toLowerCase().replaceAll("_", " ")}
                  </span>
                  <small>
                    {row.seller?.name ?? "HelaCart support"} ·{" "}
                    {dateTime(row.updatedAt)}
                  </small>
                  {row.financeHold && (
                    <small>Commission on hold while this case is open</small>
                  )}
                </button>
              ))
            ) : !list.error ? (
              <p className={styles.muted}>No cases match this filter.</p>
            ) : null}
          </div>
          <FinancePager
            data={list.data}
            onPage={setPage}
            loading={list.loading}
          />
        </section>
        {selected ? (
          <SupportThread
            key={selected}
            id={selected}
            root={root}
            role={role}
            request={request}
            isPreview={isPreview}
            onChanged={refresh}
          />
        ) : (
          <section className={styles.card}>
            <h2>Your conversation</h2>
            <p className={styles.muted}>
              Select a case to read replies and follow its progress.
              Order-related cases include the buyer, shop and HelaCart team.
            </p>
          </section>
        )}
      </div>
      {creating && (
        <CreateCaseDialog
          root={root}
          request={request}
          orderId={orderId}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setSelected(id);
            setCreating(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
function SupportThread({
  id,
  root,
  role,
  request,
  isPreview,
  onChanged,
}: {
  id: string;
  root: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  request: FinanceRequest;
  isPreview: boolean;
  onChanged: () => void;
}) {
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [decision, setDecision] = useState<SupportCase | null>(null);
  const intent = useRef({ payload: "", key: "" }),
    operation = useRef(false);
  const detail = useFinanceResource<SupportCase>(
      `${root}/support/${id}`,
      sampleCase,
      request,
      isPreview,
      revision,
    ),
    messages = useFinanceResource<Page<CaseMessage>>(
      `${root}/support/${id}/messages?page=${page}`,
      emptyPage(sampleMessages),
      request,
      isPreview,
      revision,
    );
  function refresh() {
    setRevision((v) => v + 1);
    onChanged();
  }
  async function reply(e: FormEvent) {
    e.preventDefault();
    if (operation.current || isPreview || !body.trim()) return;
    const text = body.trim();
    if (intent.current.payload !== text)
      intent.current = { payload: text, key: crypto.randomUUID() };
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`${root}/support/${id}/messages`, "POST", {
        requestKey: intent.current.key,
        body: text,
      });
      setBody("");
      intent.current = { payload: "", key: "" };
      setPage(1);
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const row = detail.data;
  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <h2>{row?.title ?? "Support conversation"}</h2>
          <small>
            {row?.category.toLowerCase().replaceAll("_", " ")} ·{" "}
            {row?.status.toLowerCase().replaceAll("_", " ")}
          </small>
        </div>
        <button
          className="outline-btn"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh conversation
        </button>
      </div>
      <FinanceFeedback error={detail.error || messages.error || error} />
      {detail.loading && <p>Loading case details…</p>}
      {row && (
        <>
          {row.financeHold && (
            <p className={styles.notice}>
              Commission for this order is held during this case review.
            </p>
          )}
          {row.sellerOrder && (
            <p className={styles.muted}>
              Order #{row.sellerOrder.orderId.slice(0, 8).toUpperCase()} ·{" "}
              {row.seller?.name}
            </p>
          )}
          {row.resolution && (
            <p className={styles.notice}>
              <strong>Resolution</strong>
              <br />
              {row.resolution}
            </p>
          )}
          {role === "ADMIN" && (
            <button
              className="outline-btn"
              disabled={isPreview}
              onClick={() => setDecision(row)}
            >
              Update case status
            </button>
          )}
          <div className={styles.messages} aria-live="polite">
            {messages.loading ? (
              <p>Loading replies…</p>
            ) : (
              messages.data?.items.map((message) => (
                <article
                  className={styles.message}
                  data-role={message.authorRole}
                  key={message.id}
                >
                  <header>
                    <strong>
                      {message.author.name || message.authorRole.toLowerCase()}
                    </strong>
                    <small>
                      {message.authorRole.toLowerCase()} ·{" "}
                      {dateTime(message.createdAt)}
                    </small>
                  </header>
                  <p>{message.body}</p>
                </article>
              ))
            )}
          </div>
          <FinancePager
            data={messages.data}
            onPage={setPage}
            loading={messages.loading}
          />
          {row.status === "CLOSED" ? (
            <p className={styles.muted}>
              This case is closed. You can open a new case if you need more
              help.
            </p>
          ) : (
            <form className={styles.form} onSubmit={(e) => void reply(e)}>
              <fieldset disabled={busy || isPreview}>
                <label>
                  Your reply
                  <textarea
                    required
                    maxLength={4000}
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                {row.status === "RESOLVED" && (
                  <p className={styles.muted}>
                    Sending a reply reopens this case.
                  </p>
                )}
                <button type="submit" className="primary-btn">
                  {busy ? "Sending…" : "Send reply"}
                </button>
              </fieldset>
            </form>
          )}
          {!!row.events?.length && (
            <details className={styles.history}>
              <summary>Case decisions (latest 20)</summary>
              {row.events.map((event) => (
                <p key={event.id}>
                  <strong>
                    {event.fromStatus.toLowerCase()} →{" "}
                    {event.toStatus.toLowerCase()}
                  </strong>{" "}
                  · {dateTime(event.createdAt)}
                  <br />
                  {event.reason}
                </p>
              ))}
            </details>
          )}
        </>
      )}
      {decision && (
        <CaseDecisionDialog
          data={decision}
          root={root}
          request={request}
          onClose={() => setDecision(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
function CreateCaseDialog({
  root,
  orderId,
  request,
  onClose,
  onSaved,
}: {
  root: string;
  orderId: string;
  request: FinanceRequest;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false),
    intent = useRef({ payload: "", key: "" });
  const [title, setTitle] = useState(""),
    [category, setCategory] = useState(orderId ? "ORDER_ISSUE" : "OTHER"),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current) return;
    const data = {
        title: title.trim(),
        category,
        body: body.trim(),
        ...(orderId ? { sellerOrderId: orderId } : {}),
      },
      payload = JSON.stringify(data);
    if (intent.current.payload !== payload)
      intent.current = { payload, key: crypto.randomUUID() };
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ id: string }>(`${root}/support`, "POST", {
        ...data,
        requestKey: intent.current.key,
      });
      onSaved(result.id);
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
          <h2>Open a support case</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close support form"
          >
            <X size={18} />
          </button>
        </div>
        <p className={styles.muted}>
          {orderId
            ? `Linked to order #${orderId.slice(0, 8).toUpperCase()}. The buyer, shop and HelaCart team can follow the conversation.`
            : "The HelaCart team will help with your question. For an order issue, use Get support on that order to include its shop."}
        </p>
        <fieldset disabled={busy}>
          <label>
            Subject
            <input
              required
              minLength={5}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Topic
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {supportCategories.map((c) => (
                <option value={c} key={c}>
                  {c.toLowerCase().replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            How can we help?
            <textarea
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button type="submit" className="primary-btn">
            {busy ? "Opening…" : "Create support case"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
function CaseDecisionDialog({
  data,
  root,
  request,
  onClose,
  onSaved,
}: {
  data: SupportCase;
  root: string;
  request: FinanceRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    operation = useRef(false);
  const [status, setStatus] = useState(data.status),
    [hold, setHold] = useState(data.financeHold),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await request(`${root}/support/${data.id}`, "PATCH", {
        version: data.version,
        status,
        financeHold: hold,
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
        <div className={styles.heading}>
          <h2>Update support case</h2>
          <button
            type="button"
            className="outline-btn"
            disabled={busy}
            onClick={onClose}
            aria-label="Close case decision"
          >
            <X size={18} />
          </button>
        </div>
        <fieldset disabled={busy}>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (["RESOLVED", "CLOSED"].includes(e.target.value))
                  setHold(false);
              }}
            >
              {supportStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          {data.sellerOrderId && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={hold}
                disabled={["RESOLVED", "CLOSED"].includes(status)}
                onChange={(e) => setHold(e.target.checked)}
              />{" "}
              Hold commission while this case is open
            </label>
          )}
          <label>
            Decision or resolution note
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className={styles.muted}>
            Resolving or closing releases this case’s commission hold. Other
            return, refund or manual holds still apply.
          </p>
          <button className="primary-btn" type="submit">
            {busy ? "Saving…" : "Save case decision"}
          </button>
        </fieldset>
        <FinanceFeedback error={error} />
      </form>
    </dialog>
  );
}
