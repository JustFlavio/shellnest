import { AppHeader } from "./AppHeader";
import { useApp } from "./app-context";
import { BulkAssignDialog } from "./BulkAssignDialog";
import { DeletionDialog } from "./DeletionDialog";
import { EditorPanels } from "./EditorPanels";
import { ErrorBanner, NoticeBanner, PreviewBanner } from "./Banners";
import { LauncherPage } from "./LauncherPage";
import { cn } from "./lib/utils";
import { SettingsPanel } from "./SettingsPanel";
import { Sidebar } from "./Sidebar";
import { TerminalStage } from "./TerminalStage";
import { TrustDialog } from "./TrustDialog";
import { VaultPage } from "./VaultPage";
import { VaultPanels } from "./VaultPanels";
import { WorkspaceDialog } from "./WorkspaceDialog";

/** The unlocked app: tab bar, sidebar, the active page and every dialog. */
export function Workbench() {
  const {
    vault: { preview },
    tabs: { active },
  } = useApp();
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
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
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
