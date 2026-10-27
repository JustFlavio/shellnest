export function LauncherFooter({
  jump,
  preview,
  quickKey,
}: {
  jump: boolean;
  preview: boolean;
  quickKey: string;
}) {
  return (
    <>
      <p className="help mt-[16px]">
        {jump
          ? "Invio passa alla scheda"
          : `Invio apre · Maiusc+Invio nuova sessione · ${quickKey} connessione rapida`}
      </p>
      {preview && (
        <p className="help mt-[16px]">
          Anteprima: connessioni SSH e terminale locale sono disponibili
          nell’app desktop.
        </p>
      )}
    </>
  );
}
