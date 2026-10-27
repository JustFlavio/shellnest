import { TitleBar } from "./TitleBar";
const skeleton =
  "block animate-[shimmer_1.4s_linear_infinite] rounded-[12px] bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--card)_25%,color-mix(in_srgb,var(--card),white_8%)_50%,var(--card)_75%)]";

export function OpeningScreen() {
  return (
    <main className="relative grid h-dvh place-items-center overflow-auto px-[20px] pt-[64px] pb-[24px]">
      <TitleBar />
      <div
        className="m-auto grid w-[min(420px,80vw)] gap-[12px] [&>.skeleton]:h-[56px] [&>.skeleton:first-child]:h-[72px]"
        role="status"
        aria-label="Apertura vault"
      >
        <span className={skeleton} />
        <span className={skeleton} />
        <span className={skeleton} />
      </div>
    </main>
  );
}
