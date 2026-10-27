// Shared look of the editors' building blocks (panel body content). Sizes are px:
// the root font is 14px, so rem-based Tailwind units would come out smaller.
export const help =
  "mt-[10px] text-[12px]! leading-[1.7] text-muted-foreground";
export const sectionHelp = `${help} mt-[12px]`;
export const callout =
  "mt-[12px] rounded-[7px] border border-input bg-accent px-[12px] py-[11px] text-[12px] leading-[1.7] text-muted-foreground";
export const errorBox =
  "mb-[12px] rounded-[7px] border border-destructive/25 bg-destructive/5 p-[11px] text-destructive";
export const muted = "text-[13px] leading-[1.7] text-muted-foreground";
export const fingerprint =
  "block rounded-[6px] border border-input bg-field p-[11px] font-mono text-[12px] break-all whitespace-normal text-muted-foreground";

// A grouped block of fields; its labels are small and spaced from one another.
export const section =
  "m-0 min-w-0 rounded-[12px] border border-border bg-card p-[16px] [&>legend]:float-left [&>legend]:mb-[10px] [&>legend]:w-full [&>legend]:p-0 [&>legend]:text-[14px] [&>legend]:font-semibold [&>legend]:text-foreground [&>legend+*]:clear-both [&_label]:mt-[10px] [&_label]:mb-0 [&_label]:text-[12px] [&>legend+label]:mt-0";
export const sheetField = "mt-[10px]";
export const portInline =
  "flex-row items-center gap-[10px] text-foreground [&_[data-slot=input]]:h-[30px] [&_[data-slot=input]]:w-[78px]";
export const vaultBar =
  "flex items-center gap-[10px] rounded-[12px] bg-card px-[16px] py-[14px] text-[14px] [&_svg]:text-muted-foreground";
export const addressIcon =
  "grid size-[36px] shrink-0 place-items-center rounded-[9px] bg-accent text-primary";
export const divider = "my-[14px] h-px bg-border";
export const subheading = "mb-[12px] text-[14px] font-semibold";
export const fieldIcon =
  "pointer-events-none absolute top-1/2 left-[11px] size-[18px] -translate-y-1/2 text-muted-foreground";
export const inheritedBox =
  "mb-[10px] flex items-center gap-[10px] rounded-[9px] border border-border bg-card px-[12px] py-[10px] text-[13px] [&>span]:min-w-0 [&>span]:flex-1 [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground";
export const selectedHostIdentity =
  "mt-[8px] flex items-center gap-[7px] text-[12px] text-muted-foreground [&>button]:ml-auto [&>svg]:size-[16px] [&>svg]:shrink-0";

// Combobox suggestion popup shared by the user and folder fields.
export const suggestionsPositioner = "z-51";
export const suggestions =
  "max-h-[280px] w-[var(--anchor-width)] overflow-auto rounded-[10px] border border-input bg-popover p-[6px] text-popover-foreground shadow-[0_8px_24px_#0005]";
export const suggestion =
  "flex cursor-pointer items-center gap-[10px] rounded-[7px] p-[10px] data-highlighted:bg-accent data-selected:bg-accent [&>svg]:size-[18px] [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&_small]:mt-[3px] [&_small]:block [&_small]:text-[12px] [&_small]:text-muted-foreground [&_strong]:block [&_strong]:text-[13px]";
export const suggestionEmpty =
  "px-[10px] py-[12px] text-[12px] text-muted-foreground";

export const hostSummary =
  "mt-[16px] grid max-h-[min(280px,32dvh)] list-none gap-[8px] overflow-y-auto p-0";
export const hostSummaryItem =
  "flex items-center gap-[12px] rounded-[12px] bg-card px-[10px] py-[9px] [&>span:last-child]:min-w-0 [&_small]:mt-[3px] [&_small]:block [&_small]:text-[12px] [&_small]:text-muted-foreground [&_small]:[overflow-wrap:anywhere] [&_strong]:block [&_strong]:[overflow-wrap:anywhere]";
export const shortcutList =
  "my-[24px] [&>div]:flex [&>div]:items-baseline [&>div]:justify-between [&>div]:gap-[16px] [&>div]:border-b [&>div]:border-border [&>div]:py-[12px] [&>div]:text-[13px] [&_dd]:m-0 [&_dd]:shrink-0 [&_dd]:text-right";
