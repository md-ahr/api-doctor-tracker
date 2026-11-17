const pattern = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(value: string): string {
  return value.replace(pattern, "\\$&");
}
