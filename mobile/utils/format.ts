const pad = (value: number) => String(value).padStart(2, "0");

// Fixed dd/mm/yyyy, so dates read the same whatever the device locale is.
export function formatDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return `${formatDate(iso)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
