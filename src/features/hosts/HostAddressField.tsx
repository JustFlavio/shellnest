import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OsIcon } from "@/components/OsIcon";
import { useFieldError } from "@/components/FieldErrors";
import { stripWhitespace } from "@/lib/input-text";
import { addressIcon } from "@/lib/editor-ui";
import type { HostDraft, View } from "@/lib/types";
import { HostPortField } from "./HostPortField";

// Address and port on one row; their errors go under the row, where there is room.
export function HostAddressField({
  value,
  view,
  onChange,
}: {
  value: HostDraft;
  view: View;
  onChange: (v: HostDraft) => void;
}) {
  const { t } = useTranslation();
  const address = useFieldError("address");
  const port = useFieldError("port");
  return (
    <>
      <div className="flex items-center gap-[10px]">
        {value.os ? (
          <OsIcon os={value.os} size="field" />
        ) : (
          <span className={addressIcon}>
            <Server className="size-5" aria-hidden="true" />
          </span>
        )}
        <label className="m-0! min-w-0 flex-1" {...address.field}>
          <span className="sr-only">{t("hosts.hostEditor.address")}</span>
          <Input
            autoFocus
            required
            value={value.address}
            onChange={(e) =>
              onChange({ ...value, address: stripWhitespace(e.target.value) })
            }
            placeholder={t("hosts.hostEditor.ipOrHostName")}
            {...address.control}
          />
        </label>
        <div {...port.field}>
          <HostPortField
            value={value}
            view={view}
            onChange={onChange}
            invalid={port.control}
          />
        </div>
      </div>
      {address.message}
      {port.message}
    </>
  );
}
