import { useApp } from "@/app/app-context";
import { SearchField } from "./SearchField";
import { SelectionBar } from "./SelectionBar";
import { UsageFilter } from "./UsageFilter";
import { VaultContent } from "./VaultContent";
import { VaultHeader } from "./VaultHeader";
import { VaultToolbar } from "./VaultToolbar";

export function VaultPage() {
  const {
    library: { page, selected },
  } = useApp();
  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <VaultHeader />
      <SearchField />
      <VaultToolbar />
      <UsageFilter />
      {page === "hosts" && selected.size > 1 && <SelectionBar />}
      <VaultContent />
    </section>
  );
}
