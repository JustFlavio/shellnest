import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useApp } from "@/app/app-context";

export function SearchField() {
  const { t } = useTranslation();
  const {
    library: { page, query, setQuery, search },
  } = useApp();
  return (
    <div className="px-[22px] py-[14px] max-[1100px]:px-[18px]">
      <div className="flex w-full items-center gap-[9px] rounded-[7px] border border-border bg-field px-[12px] text-muted-foreground focus-within:border-ring">
        <Search size={16} />
        <Input
          ref={search}
          className="h-[36px] flex-1 rounded-none border-0 bg-transparent px-0 py-[7px] shadow-none outline-none focus-visible:border-0 focus-visible:outline-none"
          aria-label={t("hosts.searchField.search")}
          placeholder={
            page === "hosts"
              ? t("hosts.searchField.searchNameAddressOr")
              : page === "identities"
                ? t("hosts.searchField.searchIdentityUserOr")
                : t("hosts.searchField.searchKeyOrFingerprint")
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <Button
            variant="ghost"
            aria-label={t("hosts.searchField.clearSearch")}
            onClick={() => setQuery("")}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
