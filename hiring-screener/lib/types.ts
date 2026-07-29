import type { LocationChoice, Role } from "./roles";

export type Stage =
  | "Applied"
  | "Screened"
  | "Shortlisted"
  | "Interview"
  | "Final Select"
  | "Rejected";

export const STAGES: Stage[] = [
  "Applied",
  "Screened",
  "Shortlisted",
  "Interview",
  "Final Select",
  "Rejected",
];

export type RecommendedStage = "Shortlist" | "Borderline" | "Reject";

export type Source = "form" | "linkedin";

export interface AnsweredQuestion {
  id: string;
  question: string;
  answer: string;
  points: number;
}

export interface ApplicationRecord {
  id: string;
  role: Role | null;
  name: string;
  linkedin: string | null;
  location_choice: LocationChoice | null;
  answers: AnsweredQuestion[];
  free_text: string | null;
  cv_url: string | null;
  cv_filename: string | null;
  mechanical_score: number | null;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_recommended_stage: RecommendedStage | null;
  stage: Stage;
  submitted_at: string;
  source: Source;
  tags: string[];
}

export interface LinkedInMessage {
  id: string;
  chat_id: string;
  message_id: string;
  sender_name: string;
  sender_profile_url: string | null;
  is_sender: boolean;
  text: string | null;
  has_cv_attachment: boolean;
  message_timestamp: string | null;
  created_at: string;
}

export interface LinkedInThreadSummary {
  chat_id: string;
  contact_name: string;
  contact_profile_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  message_count: number;
}

export interface ApplicationSubmission {
  role: Role;
  name: string;
  linkedin?: string;
  locationChoice?: LocationChoice;
  answers: { id: string; answer: string }[];
  freeText: string;
  cvUrl?: string;
  cvFilename?: string;
}

export interface ScreeningSession {
  id: string;
  name: string;
  created_at: string;
}

export interface ScreeningRole {
  id: string;
  session_id: string;
  title: string;
  jd_text: string;
  created_at: string;
}

export interface ScreeningCandidate {
  id: string;
  session_id: string;
  name: string;
  name_confirmed: boolean;
  cv_url: string;
  cv_filename: string;
  cv_text: string | null;
  cv_text_error: string | null;
  created_at: string;
}

export interface ScreeningResult {
  id: string;
  candidate_id: string;
  role_id: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_recommended_stage: RecommendedStage | null;
  stage: Stage;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type RoleStatus = "pending" | "partial" | "done";

export interface ScreeningRoleWithStatus extends ScreeningRole {
  status: RoleStatus;
  scoredCount: number;
  candidateCount: number;
}

export interface ScreeningSessionSummary extends ScreeningSession {
  candidateCount: number;
  roles: ScreeningRoleWithStatus[];
}

export interface ScreeningSessionDetail extends ScreeningSession {
  roles: ScreeningRoleWithStatus[];
  candidates: ScreeningCandidate[];
  results: ScreeningResult[];
}
