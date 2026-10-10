const DISPLAY_TIME_ZONE = "Asia/Shanghai";

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

export function getInitials(firstName: string, lastName: string): string {
  const name = (firstName || lastName || "").trim();
  return (name.charAt(0) || "U").toUpperCase();
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

const CJK_NAME = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/;

export function joinName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first) return last;
  if (!last) return first;
  return CJK_NAME.test(first) && CJK_NAME.test(last) ? `${first}${last}` : `${first} ${last}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(d);
}

export function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);

  if (minutes < 1) return RELATIVE_FORMAT.format(0, "second");
  if (minutes < 60) return RELATIVE_FORMAT.format(-minutes, "minute");
  if (hours < 24) return RELATIVE_FORMAT.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE_FORMAT.format(-days, "day");
  if (days < 30) return RELATIVE_FORMAT.format(-Math.floor(days / 7), "week");
  return formatDate(dateStr);
}
