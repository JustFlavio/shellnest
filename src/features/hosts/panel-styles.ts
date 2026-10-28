// Panel look per variant. Children (forms, footers, paragraphs) are styled from
// here because the call sites hand over plain markup.
const panelFooterBase =
  "[&>footer]:sticky [&>footer]:bottom-[-16px] [&>footer]:z-2 [&>footer]:-mx-[16px] [&>footer]:mt-auto [&>footer]:-mb-[16px] [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-[8px] [&>footer]:border-t [&>footer]:border-border [&>footer]:bg-sidebar [&>footer]:px-[16px] [&>footer]:py-[14px] " +
  "[&>form>footer]:sticky [&>form>footer]:bottom-[-16px] [&>form>footer]:z-2 [&>form>footer]:-mx-[16px] [&>form>footer]:mt-auto [&>form>footer]:-mb-[16px] [&>form>footer]:flex [&>form>footer]:justify-end [&>form>footer]:gap-[8px] [&>form>footer]:border-t [&>form>footer]:border-border [&>form>footer]:bg-sidebar [&>form>footer]:px-[16px] [&>form>footer]:py-[14px] " +
  "[&_footer_button]:h-[34px] [&_footer_button]:px-[13px] [&_footer_.primary]:flex-1";
const panelBodyBase =
  "min-h-0 flex-1 overflow-auto p-[16px] [&>form]:flex [&>form]:min-h-full [&>form]:flex-col [&>form]:gap-[14px] [&>form>label]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.7] " +
  panelFooterBase;
export const panelStyles = {
  sheet: {
    // A nested dialog has no backdrop of its own, so the sheet's backdrop dims
    // the page once a centered panel or a confirmation sits on top of it.
    overlay:
      "bg-transparent supports-backdrop-filter:backdrop-blur-none [body.dialog-open:not(.alert-open)_&]:bg-[#080b1026] max-[1100px]:[body.dialog-open:not(.alert-open)_&]:bg-[#080b1070] [body.alert-open_&]:bg-[#04060ccc] [body.dialog-open_&]:top-0 [body.alert-open_&]:top-0",
    content:
      "side-sheet fixed top-[46px] flex flex-col gap-0 p-0 right-0 bottom-0 left-auto h-[calc(100dvh-46px)] w-[var(--sheet-width)] max-w-[100vw] translate-x-0 translate-y-0 rounded-none border-0 border-l border-border bg-background shadow-none ring-0 sm:max-w-[100vw] max-[760px]:w-[min(var(--sheet-width),100vw)] [body:not(:has(.app))_&]:top-0 [body:not(:has(.app))_&]:h-dvh data-closed:pointer-events-none data-open:animate-[sheet-in_0.22s_cubic-bezier(0.2,0.7,0.2,1)] " +
      "[&>footer]:flex [&>footer]:shrink-0 [&>footer]:justify-end [&>footer]:gap-[8px] [&>footer]:border-t [&>footer]:border-border [&>footer]:bg-[color-mix(in_srgb,var(--background)_92%,black)] [&>footer]:px-[14px] [&>footer]:py-[12px] " +
      "[&_[data-slot=input]]:rounded-[10px] [&_[data-slot=input]]:text-[14px] [&_[data-slot=select-trigger]]:rounded-[10px] [&_[data-slot=select-trigger]]:text-[14px] [&_footer_button]:h-[34px] [&_footer_button]:rounded-[10px] [&_footer_button]:px-[13px] [&_footer_button]:text-[14px] [&_footer_.primary]:flex-1 " +
      "[&_[data-slot=input]:hover]:border-[color-mix(in_srgb,var(--input),var(--muted-foreground)_35%)] [&_[data-slot=select-trigger]:hover]:border-[color-mix(in_srgb,var(--input),var(--muted-foreground)_35%)]",
    header: "bg-sidebar px-[18px] shadow-[0_1px_0_var(--border)]",
    title: "text-[14px] leading-[1.4]",
    body: panelBodyBase + " [&>form]:min-h-0 [&>form]:gap-[16px]",
  },
  dialog: {
    overlay:
      "bg-[#080b1026] max-[1100px]:bg-[#080b1070] supports-backdrop-filter:backdrop-blur-none",
    content:
      "centered-panel flex w-[480px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] flex-col gap-0 bg-sidebar p-0 sm:max-w-[calc(100vw-32px)] [&_.fingerprint]:[overflow-wrap:anywhere]",
    header: "",
    title: "text-[13px]",
    body:
      panelBodyBase +
      " flex-[0_1_auto] [&>form]:min-h-0 [&_footer_.primary]:flex-none [&>footer]:static [&>footer]:mt-[20px] [&>footer]:flex-wrap [&>form>footer]:static [&>form>footer]:mt-[20px] [&>form>footer]:flex-wrap",
  },
  alert: {
    overlay: "bg-[#04060c99] supports-backdrop-filter:backdrop-blur-none",
    content:
      "centered-panel alert-panel flex w-[440px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] flex-col gap-0 overflow-hidden rounded-[16px] border border-border bg-background p-0 shadow-[0_24px_64px_#0008] ring-0 sm:max-w-[calc(100vw-32px)]",
    header:
      "min-h-[60px] bg-card px-[20px] [&_button]:size-[32px] [&_button]:text-foreground [&_button_svg]:!size-[20px]",
    title: "text-[17px]",
    body:
      "flex-[0_1_auto] px-[20px] pt-[24px] pb-[20px] min-h-0 overflow-auto [&_p]:text-[14px] [&_p]:leading-[1.7] [&_p]:text-foreground [&>[data-slot]]:text-[14px] [&>[data-slot]]:text-foreground " +
      "[&>footer]:mt-[18px] [&>footer]:flex [&>footer]:justify-end [&>footer]:gap-[8px] [&_footer_button]:h-[38px] [&_footer_button]:px-[18px] [&_footer_button]:font-semibold [&_footer_button]:text-[14px] " +
      "[&_footer_.danger]:border-0 [&_footer_.danger]:bg-destructive [&_footer_.danger]:text-[#1a0f0d] [&_footer_.danger:hover:not(:disabled)]:bg-[color-mix(in_srgb,var(--destructive),white_12%)] [&_footer_.primary]:border-0",
  },
} as const;
