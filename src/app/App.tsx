import { AppContext } from "./app-context";
import { Toaster } from "@/components/ui/sonner";
import { LockScreen } from "@/features/vault/LockScreen";
import { OpeningScreen } from "./OpeningScreen";
import { useAppState } from "./useAppState";
import { useNativeMenu } from "./useNativeMenu";
import { useShortcuts } from "./useShortcuts";
import { Workbench } from "./Workbench";

export function App() {
  const app = useAppState();
  useShortcuts(app);
  useNativeMenu(app);
  const { opening, view } = app.vault;
  return (
    <AppContext value={app}>
      {opening ? (
        <OpeningScreen />
      ) : view.unlocked ? (
        <Workbench />
      ) : (
        <LockScreen />
      )}
      <Toaster />
    </AppContext>
  );
}
