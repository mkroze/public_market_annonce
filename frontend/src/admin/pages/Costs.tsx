import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, CheckCircle2, Loader2, Pencil, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import Pagination from "../../components/Pagination";
import ToastContainer from "../../components/Toast";
import {
  ApiError, archiveCost, createCost, getCostSummary,
  getCosts, markCostPaid, updateCost,
} from "../api";
import { can } from "../permissions";
import type {
  BillingCycle, CostCategory, CostCurrency, CostStatus,
  WebsiteCost, WebsiteCostPayload, WebsiteCostSummary,
} from "../types";
import { EmptyState, FailedState, FilteredEmptyState, LoadingState, DeniedState } from "../components/StateBlock";
import { GatedButton, MetricCard, PageHeader, Panel, fmtDateOnly } from "../components/ui";
import { CostStatusBadge } from "../components/StatusBadge";
import { useToasts } from "../components/useToasts";

const FILTER_KEYS = ["q", "category", "status", "currency", "date_from", "date_to"];
const CATEGORIES: CostCategory[] = ["hosting", "domain", "email", "ai_api", "storage", "monitoring", "scraping", "software", "other"];
const CURRENCIES: CostCurrency[] = ["MAD", "USD", "EUR"];
const CYCLES: BillingCycle[] = ["monthly", "yearly", "one_off", "usage_based"];
const STATUSES: CostStatus[] = ["planned", "due", "paid", "overdue", "cancelled"];

const CONTROL = "w-full border border-[var(--color-border-subtle)] bg-base-100 rounded px-3 py-2 text-sm font-sans text-[var(--color-charcoal)] focus:border-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-crimson)] transition-colors disabled:opacity-60";

const EMPTY_DRAFT: WebsiteCostPayload = {
  provider: "",
  category: "ai_api",
  description: "",
  amount_minor: 0,
  currency: "MAD",
  billing_cycle: "monthly",
  service_period_start: null,
  service_period_end: null,
  due_date: null,
  paid_date: null,
  status: "planned",
  reference: "",
  notes: "",
};

type LargestCategory = NonNullable<WebsiteCostSummary["largest_current_month_category"][CostCurrency]>;

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function formatMoney(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatGrouped(values: Record<string, number> | undefined): string {
  const entries = Object.entries(values || {}).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return "0,00";
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" · ");
}

function draftFrom(cost: WebsiteCost): WebsiteCostPayload {
  return {
    provider: cost.provider,
    category: cost.category,
    description: cost.description,
    amount_minor: cost.amount_minor,
    currency: cost.currency,
    billing_cycle: cost.billing_cycle,
    service_period_start: cost.service_period_start,
    service_period_end: cost.service_period_end,
    due_date: cost.due_date,
    paid_date: cost.paid_date,
    status: cost.status,
    reference: cost.reference,
    notes: cost.notes,
  };
}

function amountInputValue(amountMinor: number): string {
  return amountMinor ? String(amountMinor / 100) : "";
}

function parseAmountMinor(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  return Math.round(Number(normalized) * 100);
}

export default function Costs() {
  const { user } = useAuth();
  const canManage = can(user?.role, "costs.manage");
  const { toasts, push, dismiss } = useToasts();
  const [params, setParams] = useSearchParams();
  const [summary, setSummary] = useState<WebsiteCostSummary | null>(null);
  const [rows, setRows] = useState<WebsiteCost[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<WebsiteCost | null>(null);
  const [draft, setDraft] = useState<WebsiteCostPayload | null>(null);
  const [saving, setSaving] = useState(false);

  const page = Number(params.get("page") || "1");
  const hasFilters = FILTER_KEYS.some((key) => params.get(key));

  const load = useCallback(() => {
    setLoading(true);
    const query: Record<string, string> = { page: String(page), per_page: "25" };
    FILTER_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) query[key] = value;
    });
    Promise.all([getCostSummary(), getCosts(query)])
      .then(([summaryRes, listRes]) => {
        setSummary(summaryRes);
        setRows(listRes.data);
        setTotal(listRes.total);
        setPages(listRes.pages);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [page, params]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  }

  function clearFilters() {
    setParams(new URLSearchParams());
  }

  function openCreate() {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(cost: WebsiteCost) {
    setEditing(cost);
    setDraft(draftFrom(cost));
  }

  function patchDraft(patch: Partial<WebsiteCostPayload>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  async function submitDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !canManage || draft.amount_minor <= 0) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCost(editing.id, draft);
        push("Cost updated", "success");
      } else {
        await createCost(draft);
        push("Cost created", "success");
      }
      setDraft(null);
      setEditing(null);
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to save cost", "error");
    } finally {
      setSaving(false);
    }
  }

  async function doMarkPaid(cost: WebsiteCost) {
    if (!canManage) return;
    try {
      await markCostPaid(cost.id);
      push("Cost marked as paid", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to mark paid", "error");
    }
  }

  async function doArchive(cost: WebsiteCost) {
    if (!canManage) return;
    try {
      await archiveCost(cost.id);
      push("Cost archived", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to archive cost", "error");
    }
  }

  const largest = useMemo(() => {
    if (!summary) return "—";
    return Object.values(summary.largest_current_month_category)
      .filter((item): item is LargestCategory => Boolean(item))
      .map((item) => `${label(item.category)} · ${formatMoney(item.amount_minor, item.currency)}`)
      .join(" · ") || "—";
  }, [summary]);

  if (loading) return <LoadingState label="Loading costs" />;
  if (error?.status === 403) return <DeniedState message={error.message} />;
  if (error) return <FailedState message={error.message} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Costs"
        description="Internal website operating expenses, provider renewals, and API usage costs."
        actions={
          <GatedButton allowed={canManage} reason="Requires costs.manage permission" onClick={openCreate}>
            <Plus className="w-4 h-4" aria-hidden /> Add cost
          </GatedButton>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Current month" value={<span className="text-base">{formatGrouped(summary?.current_month)}</span>} sub={largest} />
        <MetricCard label="Upcoming unpaid" value={<span className="text-base">{formatGrouped(summary?.upcoming_unpaid)}</span>} sub="Due in the next 45 days" />
        <MetricCard label="Overdue" value={<span className="text-base">{formatGrouped(summary?.overdue)}</span>} tone={Object.keys(summary?.overdue || {}).length ? "danger" : "neutral"} />
        <MetricCard label="Annualized recurring" value={<span className="text-base">{formatGrouped(summary?.annualized_recurring)}</span>} sub="Monthly and yearly costs" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          aria-label="Search provider, description, reference"
          placeholder="Search provider, description, reference"
          className={`${CONTROL} w-72`}
          defaultValue={params.get("q") || ""}
          onKeyDown={(event) => {
            if (event.key === "Enter") setFilter("q", (event.target as HTMLInputElement).value);
          }}
        />
        <select aria-label="Category" className={`${CONTROL} w-40`} value={params.get("category") || ""} onChange={(e) => setFilter("category", e.target.value)}>
          <option value="">Any category</option>
          {CATEGORIES.map((category) => <option key={category} value={category}>{label(category)}</option>)}
        </select>
        <select aria-label="Status" className={`${CONTROL} w-36`} value={params.get("status") || ""} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
        </select>
        <select aria-label="Currency" className={`${CONTROL} w-32`} value={params.get("currency") || ""} onChange={(e) => setFilter("currency", e.target.value)}>
          <option value="">Any currency</option>
          {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          From <input type="date" aria-label="Date from" className={`${CONTROL} w-40`} value={params.get("date_from") || ""} onChange={(e) => setFilter("date_from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs font-sans text-[var(--color-slate)]">
          To <input type="date" aria-label="Date to" className={`${CONTROL} w-40`} value={params.get("date_to") || ""} onChange={(e) => setFilter("date_to", e.target.value)} />
        </label>
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
            Clear filters
          </button>
        )}
      </div>

      <Panel>
        {rows.length === 0 ? (
          hasFilters
            ? <FilteredEmptyState onReset={clearFilters} />
            : <EmptyState title="No costs recorded" hint="Add provider costs as they appear so the website burn rate stays visible." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-[var(--color-slate)] border-b border-[var(--color-border-subtle)]">
                  <th scope="col" className="px-4 py-2 font-medium">Provider</th>
                  <th scope="col" className="px-4 py-2 font-medium">Category</th>
                  <th scope="col" className="px-4 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Cycle</th>
                  <th scope="col" className="px-4 py-2 font-medium">Due / period</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-4 py-2 font-medium">Updated</th>
                  <th scope="col" className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((cost) => (
                  <tr key={cost.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-ivory-dim)]/40">
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--color-charcoal)]">{cost.provider}</div>
                      <div className="text-xs text-[var(--color-slate)]">{cost.description || "—"}</div>
                    </td>
                    <td className="px-4 py-2 capitalize">{label(cost.category)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(cost.amount_minor, cost.currency)}</td>
                    <td className="px-4 py-2 capitalize">{label(cost.billing_cycle)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      <div>{fmtDateOnly(cost.due_date)}</div>
                      <div className="text-xs text-[var(--color-slate)]">
                        {fmtDateOnly(cost.service_period_start)} → {fmtDateOnly(cost.service_period_end)}
                      </div>
                    </td>
                    <td className="px-4 py-2"><CostStatusBadge status={cost.status} /></td>
                    <td className="px-4 py-2 text-[var(--color-slate)]">{cost.reference || "—"}</td>
                    <td className="px-4 py-2">
                      <div className="tabular-nums">{fmtDateOnly(cost.updated_at)}</div>
                      <div className="text-xs text-[var(--color-slate)]">{cost.updated_by || "—"}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(cost)}
                          disabled={!canManage}
                          title={!canManage ? "Requires costs.manage permission" : "Edit cost"}
                          aria-label={`Edit ${cost.provider}`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => doMarkPaid(cost)}
                          disabled={!canManage || cost.status === "paid"}
                          title={!canManage ? "Requires costs.manage permission" : cost.status === "paid" ? "Already paid" : "Mark paid"}
                          aria-label={`Mark ${cost.provider} paid`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => doArchive(cost)}
                          disabled={!canManage}
                          title={!canManage ? "Requires costs.manage permission" : "Archive cost"}
                          aria-label={`Archive ${cost.provider}`}
                          className="p-1.5 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40"
                        >
                          <Archive className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4">
              <Pagination
                page={page}
                pages={pages}
                total={total}
                onPageChange={(nextPage) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(nextPage));
                  setParams(next);
                }}
              />
            </div>
          </div>
        )}
      </Panel>

      {draft && (
        <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label={editing ? "Edit cost" : "Add cost"}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDraft(null)} />
          <form onSubmit={submitDraft} className="relative h-full w-full max-w-xl overflow-y-auto bg-base-100 border-l border-[var(--color-border-subtle)] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-[var(--color-charcoal)]">{editing ? "Edit cost" : "Add cost"}</h2>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="p-1 rounded hover:bg-[var(--color-ivory-dim)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Provider</span>
                <input className={CONTROL} value={draft.provider} onChange={(e) => patchDraft({ provider: e.target.value })} required />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Description</span>
                <input className={CONTROL} value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Amount</span>
                <input className={CONTROL} inputMode="decimal" value={amountInputValue(draft.amount_minor)} onChange={(e) => patchDraft({ amount_minor: parseAmountMinor(e.target.value) })} required />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Currency</span>
                <select className={CONTROL} value={draft.currency} onChange={(e) => patchDraft({ currency: e.target.value as CostCurrency })}>
                  {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Category</span>
                <select className={CONTROL} value={draft.category} onChange={(e) => patchDraft({ category: e.target.value as CostCategory })}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{label(category)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Cycle</span>
                <select className={CONTROL} value={draft.billing_cycle} onChange={(e) => patchDraft({ billing_cycle: e.target.value as BillingCycle })}>
                  {CYCLES.map((cycle) => <option key={cycle} value={cycle}>{label(cycle)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Status</span>
                <select className={CONTROL} value={draft.status} onChange={(e) => patchDraft({ status: e.target.value as CostStatus })}>
                  {STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Due date</span>
                <input type="date" className={CONTROL} value={draft.due_date || ""} onChange={(e) => patchDraft({ due_date: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Service start</span>
                <input type="date" className={CONTROL} value={draft.service_period_start || ""} onChange={(e) => patchDraft({ service_period_start: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Service end</span>
                <input type="date" className={CONTROL} value={draft.service_period_end || ""} onChange={(e) => patchDraft({ service_period_end: e.target.value || null })} />
              </label>
              <label className="space-y-1.5">
                <span className="editorial-label text-[var(--color-slate)]">Paid date</span>
                <input type="date" className={CONTROL} value={draft.paid_date || ""} onChange={(e) => patchDraft({ paid_date: e.target.value || null })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Reference</span>
                <input className={CONTROL} value={draft.reference} onChange={(e) => patchDraft({ reference: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="editorial-label text-[var(--color-slate)]">Notes</span>
                <textarea className={`${CONTROL} min-h-24`} value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="px-3 py-1.5 text-sm font-sans rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !draft.provider.trim() || draft.amount_minor <= 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans font-medium rounded text-white bg-[var(--color-crimson)] hover:bg-[var(--color-crimson-dark)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-crimson)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
