import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/IconButton";

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-[42px]", className)}
      />
      <IconButton
        label={
          visible
            ? t("components.passwordInput.hidePassword")
            : t("components.passwordInput.showPassword")
        }
        className="absolute inset-y-0 right-[5px] my-auto text-muted-foreground"
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </IconButton>
    </div>
  );
}
