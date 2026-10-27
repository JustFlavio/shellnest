import type { ReactNode } from "react";
import { section } from "@/lib/editor-ui";

export function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={section}>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
