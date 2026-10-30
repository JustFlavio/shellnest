import type { HostDraft, View } from "@/lib/types";

/** The save_host command for a host form: what the host editor and the quick connection both send. */
export function saveHostCommand(
  invokeScoped: <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<T>,
  draft: HostDraft,
) {
  const {
    credentials,
    username,
    keyId,
    hasPassword,
    inheritIdentity,
    port: _effectivePort,
    ownPort,
    effectiveIdentityId: _effectiveIdentity,
    identitySource: _identitySource,
    ...host
  } = draft;
  return invokeScoped<View>("save_host", {
    host: { ...host, port: ownPort },
    inherit: !!inheritIdentity,
    credentials:
      host.identityId || inheritIdentity
        ? null
        : (credentials ?? { username: username ?? "", password: "", keyId }),
  });
}
