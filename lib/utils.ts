import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(dateInput: Date | string): string {
  if (!dateInput) return "";
  
  let dateString = typeof dateInput === "string" ? dateInput : String(dateInput);
  if (typeof dateInput === "string" && !dateInput.endsWith("Z") && dateInput.includes(" ")) {
    dateString = dateInput.replace(" ", "T") + "Z";
  } else if (typeof dateInput === "string" && !dateInput.endsWith("Z") && dateInput.includes("T")) {
    dateString = dateInput + "Z";
  }

  const date = typeof dateInput === "string" ? new Date(dateString) : dateInput as Date;
  
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


export function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
