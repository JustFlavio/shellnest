import type { Host, WorkspaceDraft } from "@/lib/types";
import type { ConnectionTarget } from "./connection-target.ts";

/** An unknown host key waiting for the user's answer, and what to resume once trusted. */
export type Trust = {
  host?: Host;
  quick?: ConnectionTarget;
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
