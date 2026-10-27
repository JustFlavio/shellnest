import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { errorBox, fieldIcon } from "@/lib/editor-ui";

export function HostPasswordInput({
  hasSavedPassword,
  onReveal,
  ...props
}: ComponentProps<typeof Input> & {
  hasSavedPassword: boolean;
  onReveal?: () => Promise<string>;
}) {
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
        if (generation === request.current) setError(String(e));
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
        <Button
          variant="ghost"
          type="button"
          size="icon-sm"
          className="absolute inset-y-0 right-[5px] my-auto text-muted-foreground"
          aria-label={visible ? "Nascondi password" : "Mostra password"}
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
            <LoaderCircle className="size-4 animate-spin" />
          ) : visible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </div>
      {error && (
        <p className={errorBox} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
