import { PageHeader } from "../components/ui";
import { EmptyState } from "../components/StateBlock";

export default function Costs() {
  return (
    <div>
      <PageHeader
        title="Costs"
        description="Internal website operating expenses and upcoming provider costs."
      />
      <EmptyState title="Costs page loading soon" hint="The ledger UI is implemented in the next task." />
    </div>
  );
}
