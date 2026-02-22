export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDocType(type: string): string {
  const map: Record<string, string> = {
    brand_guideline: "Brand Guideline",
    product_catalog: "Product Catalog",
    style_guide: "Style Guide",
    other: "Other",
  };
  return map[type] || type;
}

export function calculateTrend(data: Array<{ date: string; avgRating: number }>): number {
  if (!data || data.length < 2) return 0;
  const first = data[0].avgRating;
  const last = data[data.length - 1].avgRating;
  if (first === 0) return 0;
  return Math.round(((last - first) / first) * 100);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}
