export type ConnectionTarget = {
  address: string;
  port: number;
  username?: string;
};
export function parseConnectionTarget(input: unknown): ConnectionTarget | null;
