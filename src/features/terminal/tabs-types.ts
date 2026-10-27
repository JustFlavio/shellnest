import type { Host, WorkspaceDraft } from "@/lib/types";
import type { QuickConnection } from "./ConnectionLauncher";

/** An unknown host key waiting for the user's answer, and what to resume once trusted. */
export type Trust = {
  host?: Host;
  quick?: QuickConnection;
  workspaces?: WorkspaceDraft[];
  activeIndex?: number;
  fingerprint: string;
  tabId?: string;
};
export type WorkspaceSave = {
  tabId?: string;
  hostIds?: string[];
  name: string;
};
