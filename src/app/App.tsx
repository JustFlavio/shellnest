import { AppContext } from "./app-context";
import { LockScreen } from "@/features/vault/LockScreen";
import { OpeningScreen } from "./OpeningScreen";
import { useAppState } from "./useAppState";
import { useShortcuts } from "./useShortcuts";
import { Workbench } from "./Workbench";

export function App() {
  const app = useAppState();
  useShortcuts(app);
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
    </AppContext>
  );
}
