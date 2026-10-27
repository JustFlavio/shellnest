import { AppHeader } from "./AppHeader";
import { useApp } from "./app-context";
import { BulkAssignDialog } from "@/features/hosts/BulkAssignDialog";
import { DeletionDialog } from "@/features/hosts/DeletionDialog";
import { EditorPanels } from "@/features/hosts/EditorPanels";
import { ErrorBanner, NoticeBanner, PreviewBanner } from "./Banners";
import { LauncherPage } from "@/features/terminal/LauncherPage";
import { cn } from "@/lib/utils";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { Sidebar } from "./Sidebar";
import { TerminalStage } from "@/features/terminal/TerminalStage";
import { TrustDialog } from "@/features/terminal/TrustDialog";
import { VaultPage } from "@/features/hosts/VaultPage";
import { VaultPanels } from "@/features/vault/VaultPanels";
import { WorkspaceDialog } from "@/features/terminal/WorkspaceDialog";

/** The unlocked app: tab bar, sidebar, the active page and every dialog. */
export function Workbench() {
  const {
    vault: { preview },
    tabs: { active },
    library: { editing },
  } = useApp();
  // The editor sheets are not modal (the tab strip stays usable), so the page behind is made inert here.
  const behindSheet = active === "vault" && editing;
  return (
    <div
      className={cn(
        "app grid h-dvh grid-rows-[46px_minmax(0,1fr)] overflow-hidden [--sidebar-width:196px] max-[1100px]:[--sidebar-width:180px] max-[760px]:[--sidebar-width:60px]",
        active === "vault"
          ? "grid-cols-[var(--sidebar-width)_minmax(0,1fr)] [body.sheet-open_&]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--sheet-width)] max-[1100px]:[body.sheet-open_&]:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
          : "no-sidebar grid-cols-[minmax(0,1fr)]",
      )}
    >
      <AppHeader />
      <Sidebar />
      <main
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        inert={behindSheet}
        aria-hidden={behindSheet || undefined}
      >
        {preview && <PreviewBanner />}
        <ErrorBanner />
        <NoticeBanner />
        {active === "launcher" && <LauncherPage />}
        {active === "vault" && <VaultPage />}
        <TerminalStage />
      </main>
      <EditorPanels />
      <BulkAssignDialog />
      <DeletionDialog />
      <SettingsPanel />
      <WorkspaceDialog />
      <TrustDialog />
      <VaultPanels />
    </div>
  );
}
