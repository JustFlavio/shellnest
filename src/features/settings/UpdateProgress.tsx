/** The bar inside the download toast; without a known size it only shows the text. */
export function UpdateProgress({
  version,
  percent,
}: {
  version: string;
  percent: number | null;
}) {
  return (
    <div className="grid gap-[6px]">
      <span>
        Shellnest {version}
        {percent !== null && ` · ${percent}%`}
      </span>
      {percent !== null && (
        <div
          role="progressbar"
          aria-label="Download dell’aggiornamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-[4px] overflow-hidden rounded-full bg-input"
        >
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
