/** Parse an SSH destination, never a command to execute in a shell. */
export function parseConnectionTarget(input) {
  if (
    typeof input !== "string" ||
    input.length > 1024 ||
    /[\x00-\x1f\x7f]/.test(input)
  )
    return null;
  let text = input.trim();
  if (!text || text === "ssh") return null;
  let explicitPort;
  if (text.startsWith("ssh ")) {
    const parts = text.split(/ +/);
    if (parts.length === 2) text = parts[1];
    else if (parts.length === 4 && parts[1] === "-p") {
      explicitPort = parts[2];
      text = parts[3];
    } else if (parts.length === 4 && parts[2] === "-p") {
      text = parts[1];
      explicitPort = parts[3];
    } else return null;
  }
  if (/\s/.test(text)) return null;
  let username;
  const at = text.indexOf("@");
  if (at !== -1) {
    username = text.slice(0, at);
    text = text.slice(at + 1);
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$/.test(username)) return null;
  }
  let address;
  let inlinePort;
  if (text.startsWith("[")) {
    const match = /^\[([0-9a-fA-F:.]+)\](?::([0-9]+))?$/.exec(text);
    if (!match || !match[1].includes(":")) return null;
    try {
      new URL(`http://[${match[1]}]/`);
    } catch {
      return null;
    }
    address = match[1];
    inlinePort = match[2];
  } else {
    const match = /^([A-Za-z0-9_.-]+)(?::([0-9]+))?$/.exec(text);
    if (!match || match[1].length > 253) return null;
    address = match[1];
    inlinePort = match[2];
    const labels = address.replace(/\.$/, "").split(".");
    if (
      labels.some(
        (label) =>
          !/^[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/.test(label),
      )
    )
      return null;
    if (
      /^[0-9.]+$/.test(address) &&
      (labels.length !== 4 || labels.some((label) => Number(label) > 255))
    )
      return null;
  }
  if (inlinePort && explicitPort) return null;
  const rawPort = explicitPort ?? inlinePort;
  if (rawPort !== undefined && !/^[0-9]{1,5}$/.test(rawPort)) return null;
  const port = rawPort === undefined ? 22 : Number(rawPort);
  if (port < 1 || port > 65535) return null;
  return { address, port, ...(username ? { username } : {}) };
}

/** Whether typed text is plainly a connection target, not just a word that happens to parse as a host name. */
export function looksLikeTarget(input) {
  const target = parseConnectionTarget(input);
  if (!target) return false;
  const text = input.trim();
  return (
    text.startsWith("ssh ") ||
    text.includes("@") ||
    text.includes(":") ||
    target.address.replace(/\.$/, "").includes(".")
  );
}

/**
 * The target the quick-connect card shows for the typed text, or null. A saved host named or
 * addressed exactly like the text already has its own row; `forced` (Cmd/Ctrl+Enter) shows
 * the card for any text that parses.
 */
export function quickConnectTarget(input, hosts, forced = false) {
  const target = parseConnectionTarget(input);
  if (!target || !(forced || looksLikeTarget(input))) return null;
  const text = input.trim().toLocaleLowerCase();
  const saved = hosts.some(
    (host) =>
      host.name.toLocaleLowerCase() === text ||
      host.address.toLocaleLowerCase() === text,
  );
  return saved ? null : target;
}
