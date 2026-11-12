import { api } from "./api";

export type ReportTargetType = "post" | "comment" | "user" | "message";
export type ReportReason = "spam" | "abuse" | "illegal" | "other";

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Спам или реклама" },
  { id: "abuse", label: "Оскорбления или травля" },
  { id: "illegal", label: "Незаконный контент" },
  { id: "other", label: "Другое" },
];

export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  comment?: string;
}): Promise<void> {
  const comment = input.comment?.trim();
  const res = await api.post("/reports", { ...input, comment: comment || undefined });
  if (res.ok) return;
  if (res.status === 401) throw new Error("Войдите, чтобы отправить жалобу");

  let message = "Не удалось отправить жалобу";
  try {
    const data = await res.json();
    if (typeof data.error === "string") message = data.error;
  } catch {
    // тело не JSON
  }
  throw new Error(message);
}