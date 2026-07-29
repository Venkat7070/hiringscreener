export type Role = "engagement_manager" | "lead" | "intern";

export interface McqOption {
  label: string;
  points: number;
}

export interface McqQuestion {
  id: string;
  question: string;
  options: McqOption[];
}

export interface RoleConfig {
  key: Role;
  title: string;
  wfoBanner: string | null;
  hasLocationChoice: boolean;
  questions: McqQuestion[];
  freeTextQuestion: string;
  criteria: string;
}

export const ROLES: Record<Role, RoleConfig> = {
  engagement_manager: {
    key: "engagement_manager",
    title: "Forward Deployed Engagement Manager",
    wfoBanner: null,
    hasLocationChoice: true,
    questions: [
      {
        id: "q1",
        question:
          "How many years of experience do you have in Customer Success, Solutions Consulting, or Forward-Deployed Engineering roles?",
        options: [
          { label: "Less than 8 years", points: 0 },
          { label: "8–12 years", points: 25 },
          { label: "More than 12 years", points: 25 },
        ],
      },
      {
        id: "q2",
        question: "Have you directly managed a cross-functional or technical team?",
        options: [
          { label: "Yes", points: 25 },
          { label: "No", points: 0 },
        ],
      },
      {
        id: "q3",
        question:
          "Do you have hands-on experience building or deploying Gen AI / agentic AI solutions (not just using tools like ChatGPT)?",
        options: [
          { label: "Yes", points: 30 },
          { label: "No", points: 0 },
        ],
      },
      {
        id: "q4",
        question: "Have you worked directly with large enterprise customers in the Americas or Europe?",
        options: [
          { label: "Yes", points: 20 },
          { label: "No", points: 0 },
        ],
      },
    ],
    freeTextQuestion:
      "Briefly describe a time you turned an ambiguous customer ask into a scoped solution.",
    criteria:
      "8-12+ years in Customer Success, Strategic Consulting, or Forward-Deployed Engineering; has directly managed cross-functional or technical teams; hands-on (not just user-level) Gen AI/agentic AI experience; direct experience with large enterprise customers, ideally Americas/Europe; genuine consulting/solutioning mindset — diagnoses root business needs, turns ambiguity into a scoped plan, weighs trade-offs, acts as a trusted advisor.",
  },
  lead: {
    key: "lead",
    title: "Forward Deployed Lead",
    wfoBanner: "This role requires mandatory Work From Office (WFO) in Bangalore, 5 days a week.",
    hasLocationChoice: false,
    questions: [
      {
        id: "q1",
        question: "How many years of overall professional experience do you have?",
        options: [
          { label: "Less than 6 years", points: 0 },
          { label: "6–10 years", points: 15 },
          { label: "More than 10 years", points: 15 },
        ],
      },
      {
        id: "q2",
        question:
          "How many years of hands-on experience do you have with Yellow.ai or a similar conversational AI platform?",
        options: [
          { label: "Less than 3 years", points: 0 },
          { label: "3 or more years", points: 25 },
        ],
      },
      {
        id: "q3",
        question: "Have you personally built RAG pipelines or agentic workflows using LLMs?",
        options: [
          { label: "Yes", points: 30 },
          { label: "No", points: 0 },
        ],
      },
      {
        id: "q4",
        question: "Have you led or mentored a team of developers?",
        options: [
          { label: "Yes", points: 30 },
          { label: "No", points: 0 },
        ],
      },
    ],
    freeTextQuestion:
      "Briefly describe the most complex integration or architecture you've owned end-to-end.",
    criteria:
      "6-10+ years overall, 3+ years hands-on with Yellow.ai or a similar conversational AI platform; has personally built RAG pipelines or agentic workflows using LLMs; has led or mentored developers; comfortable owning architecture decisions and integration design at enterprise scale.",
  },
  intern: {
    key: "intern",
    title: "Forward Deployed Engineer — Internship",
    wfoBanner: "This role requires mandatory Work From Office (WFO) in Bangalore.",
    hasLocationChoice: false,
    questions: [
      {
        id: "q1",
        question: "What's your current academic stage?",
        options: [
          { label: "Final-year student", points: 30 },
          { label: "Recent graduate (under 1 year)", points: 30 },
          { label: "Other", points: 0 },
        ],
      },
      {
        id: "q2",
        question: "How would you rate your comfort with JavaScript or Python?",
        options: [
          { label: "None", points: 0 },
          { label: "Basic", points: 15 },
          { label: "Comfortable", points: 30 },
          { label: "Strong", points: 30 },
        ],
      },
      {
        id: "q3",
        question: "Have you built any project involving LLMs or Gen AI (even a hobby project)?",
        options: [
          { label: "Yes", points: 25 },
          { label: "No", points: 0 },
        ],
      },
      {
        id: "q4",
        question: "Do you have a GitHub or portfolio link you can share?",
        options: [
          { label: "Yes", points: 15 },
          { label: "No", points: 0 },
        ],
      },
    ],
    freeTextQuestion:
      "Why do you want to work on conversational AI / agentic systems? (Include your GitHub/portfolio link if you have one.)",
    criteria:
      "Final-year student or recent graduate; solid JavaScript/Python fundamentals; has built something (even a hobby project) involving LLMs or Gen AI; shows genuine curiosity and a builder's mindset; answer about wanting the role should show authentic interest, not generic enthusiasm.",
  },
};

export const ROLE_LIST: RoleConfig[] = Object.values(ROLES);

export function isValidRole(value: string): value is Role {
  return value === "engagement_manager" || value === "lead" || value === "intern";
}

export const LOCATION_CHOICES = [
  {
    value: "bangalore_wfo",
    label: "Bangalore (Work From Office)",
    note: "This option requires mandatory Work From Office (WFO) in Bangalore.",
  },
  {
    value: "delhi_ncr_remote",
    label: "Delhi-NCR (Remote, with client travel)",
    note: null,
  },
] as const;

export type LocationChoice = (typeof LOCATION_CHOICES)[number]["value"];
