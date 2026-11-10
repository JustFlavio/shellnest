import { cn } from "@/lib/utils";

// The app icon's mark drawn flat in the theme's primary colour; the Dock and taskbar icon
// stays the fixed orange one in src-tauri/icons.
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("block size-[25px] shrink-0 text-primary", className)}
    >
      <path d="M12 2.2 20.5 7.1v9.8L12 21.8l-8.5-4.9V7.1z" />
      <path d="M7.3 9.6 9.8 12l-2.5 2.4M12.6 14.4h4.4" />
    </svg>
  );
}
