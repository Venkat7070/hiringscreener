import type { ApplicationRecord } from "./types";
import { ROLES } from "./roles";

function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADERS = [
  "name",
  "email",
  "linkedin",
  "role",
  "location_preference",
  "mechanical_score",
  "ai_score",
  "ai_rationale",
  "stage",
  "submitted_at",
  "cv_filename",
  "free_text",
];

export function applicationsToCsv(applications: ApplicationRecord[]): string {
  const rows = applications.map((app) =>
    [
      app.name,
      app.email ?? "",
      app.linkedin ?? "",
      app.role ? ROLES[app.role]?.title ?? app.role : "",
      app.location_choice ?? "",
      app.mechanical_score,
      app.ai_score ?? "",
      app.ai_rationale ?? "",
      app.stage,
      app.submitted_at,
      app.cv_filename ?? "",
      app.free_text ?? "",
    ]
      .map(escapeCsvField)
      .join(",")
  );

  return [HEADERS.join(","), ...rows].join("\n");
}
