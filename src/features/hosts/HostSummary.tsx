import { OsIcon } from "@/components/OsIcon";
import type { Host, Identity } from "@/lib/types";
import { hostSummary, hostSummaryItem } from "@/lib/editor-ui";

export function HostSummary({
  hosts,
  identities,
}: {
  hosts: Host[];
  identities: Identity[];
}) {
  return (
    <ul className={hostSummary} aria-label="Host coinvolti">
      {hosts.map((host) => {
        const identity = identities.find((item) => item.id === host.identityId);
        return (
          <li key={host.id} className={hostSummaryItem}>
            <OsIcon os={host.os} />
            <span>
              <strong>{host.name}</strong>
              <small>
                {identity?.username || host.username
                  ? `${identity?.username ?? host.username}@`
                  : ""}
                {host.address}
                {host.port === 22 ? "" : `:${host.port}`}
              </small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
