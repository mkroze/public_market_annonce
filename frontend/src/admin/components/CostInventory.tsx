import { COST_INVENTORY, INCLUDED_CAPABILITIES, type CostInventoryItem, type InventoryGroup } from "../costInventory";
import { Panel } from "./ui";

const GROUPS: InventoryGroup[] = ["Core services", "Optional integrations", "Maintenance and operations", "Planned features"];

export default function CostInventory({ canManage, onEnterPrice }: {
  canManage: boolean;
  onEnterPrice: (item: CostInventoryItem) => void;
}) {
  return (
    <Panel title="Operating cost inventory" className="admin-inventory-panel">
      <div className="admin-inventory-content font-sans text-sm">
        <div className="admin-inventory-intro space-y-2 text-[var(--color-slate)]">
          <p>
            {COST_INVENTORY.length} items to review across the current stack, optional integrations, operations, and planned features.
            This is a repository audit, not a live billing connection. Production plans and usage need confirmation.
          </p>
          <p className="font-medium text-[var(--color-charcoal)]">
            Full monthly budget = monthly services + annual renewals ÷ 12 + expected usage + maintenance hours × rate.
          </p>
          <p>
            Inventory items have no preset prices. Use Enter price to prefill a cost, choose the actual currency and billing cycle,
            and save your amount. Only saved entries affect the ledger totals above; usage-based costs are not annualized.
            Keep MAD, USD, and EUR separate until you apply your own exchange rate. Add taxes and payment fees where applicable.
          </p>
          <p>
            Annualized recurring includes planned monthly/yearly entries and can count repeated historical invoices.
            It is a ledger projection, not a complete subscription budget.
          </p>
        </div>

        <div className="admin-inventory-groups">{GROUPS.map((group) => (
          <details key={group} aria-label={group} open={group === "Core services"} className="border border-[var(--color-border-subtle)] rounded-lg">
            <summary className="min-h-11 px-3 py-3 cursor-pointer font-semibold text-[var(--color-charcoal)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
              <span>{group}</span>
              <span className="ml-2 font-normal text-xs text-[var(--color-slate)]">
                {COST_INVENTORY.filter((item) => item.group === group).length} items
              </span>
            </summary>
            <ul className="divide-y divide-[var(--color-border-subtle)] border-t border-[var(--color-border-subtle)]">
              {COST_INVENTORY.filter((item) => item.group === group).map((item) => (
                <li key={item.id} className="p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-[var(--color-charcoal)]">{item.title}</p>
                    <p className="text-[var(--color-slate)]">{item.description}</p>
                    <p className="text-[var(--color-slate)]">{item.basis}</p>
                    <details className="text-xs text-[var(--color-slate)] pt-1">
                      <summary className="cursor-pointer w-fit py-1 focus-visible:outline-2">Evidence and billing reference</summary>
                      <p className="mt-1 break-words">Repository: {item.evidence}</p>
                      {item.pricingUrl && (
                        <a href={item.pricingUrl} target="_blank" rel="noreferrer" className="inline-block py-2 underline text-[var(--color-primary)]">
                          Provider pricing / documentation (new tab)
                        </a>
                      )}
                    </details>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterPrice(item)}
                    disabled={!canManage}
                    aria-label={`Enter price for ${item.title}`}
                    title={!canManage ? "Requires costs.manage permission" : "Open a prefilled cost; nothing is saved until you enter a price"}
                    className="shrink-0 min-h-11 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-primary)] font-medium hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Enter price
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}</div>

        <details className="admin-inventory-bundled border-t border-[var(--color-border-subtle)] pt-3 text-[var(--color-slate)]">
          <summary className="cursor-pointer font-medium py-2 text-[var(--color-charcoal)] focus-visible:outline-2">
            Bundled capabilities — avoid counting these twice
          </summary>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            {INCLUDED_CAPABILITIES.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </details>
      </div>
    </Panel>
  );
}
