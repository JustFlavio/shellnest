export type StepState = "done" | "current" | "failed" | "pending";
export type TimelineStep = {
  id: "connect" | "trust" | "auth" | "session";
  label: string;
  state: StepState;
};
export function timelineSteps(input: {
  kind: "ssh" | "quick" | "local";
  target: string;
  askedTrust: boolean;
  awaitingTrust: boolean;
  phase: string;
  failure: string;
  opened: boolean;
}): TimelineStep[];
