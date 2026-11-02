import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { describeError } from "@/lib/error-message";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";
import { fieldIcon } from "@/lib/editor-ui";
import { IconButton } from "@/components/IconButton";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

export function HostPasswordInput({
  hasSavedPassword,
  onReveal,
  ...props
}: ComponentProps<typeof Input> & {
  hasSavedPassword: boolean;
  onReveal?: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [recovered, setRecovered] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const toggle = async () => {
    setError("");
    if (visible) {
      setVisible(false);
      setRecovered(null);
    } else if (props.value) {
      setVisible(true);
    } else if (hasSavedPassword && onReveal) {
      const generation = ++request.current;
      setLoading(true);
      try {
        const password = await onReveal();
        if (generation !== request.current) return;
        // Revealing is read-only: this value never enters the host draft.
        setRecovered(password);
        setVisible(true);
      } catch (e) {
        if (generation === request.current) setError(describeError(e));
      } finally {
        if (generation === request.current) setLoading(false);
      }
    }
  };
  return (
    <>
      <div className="relative [&_[data-slot=input]]:pr-[42px] [&_[data-slot=input]]:pl-[38px]">
        <KeyRound className={fieldIcon} aria-hidden="true" />
        <Input
          {...props}
          type={visible ? "text" : "password"}
          value={props.value || (visible ? (recovered ?? "") : "")}
          placeholder={
            hasSavedPassword && !props.disabled ? "••••••••" : props.placeholder
          }
          onChange={(event) => {
            request.current++;
            setLoading(false);
            setRecovered(null);
            setError("");
            props.onChange?.(event);
          }}
        />
        <IconButton
          label={
            visible
              ? t("components.passwordInput.hidePassword")
              : t("components.passwordInput.showPassword")
          }
          className="absolute inset-y-0 right-[5px] my-auto text-muted-foreground"
          aria-pressed={visible}
          aria-busy={loading}
          disabled={
            props.disabled ||
            loading ||
            (!props.value && !(hasSavedPassword && onReveal))
          }
          onClick={() => void toggle()}
        >
          {loading ? (
            <Spinner />
          ) : visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </IconButton>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-[12px]">
          {error}
        </Alert>
      )}
    </>
  );
}
