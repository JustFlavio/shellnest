export type ConnectionTarget = {
  address: string;
  port: number;
  username?: string;
};
export function parseConnectionTarget(input: unknown): ConnectionTarget | null;
export function looksLikeTarget(input: string): boolean;
export function quickConnectTarget(
  input: string,
  hosts: { name: string; address: string }[],
  forced?: boolean,
): ConnectionTarget | null;
