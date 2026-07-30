const EMAIL_REGEX = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Prefer a personal-looking address over a generic mailbox when a document contains
// several emails (e.g. a company's info@ address alongside the candidate's own).
const GENERIC_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "info",
  "support",
  "contact",
  "admin",
  "hello",
  "hr",
  "careers",
  "jobs",
  "recruiting",
  "recruitment",
];

export function extractEmail(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(EMAIL_REGEX);
  if (!matches || matches.length === 0) return null;

  const personal = matches.find((m) => {
    const localPart = m.split("@")[0].toLowerCase();
    return !GENERIC_LOCAL_PARTS.some((p) => localPart === p || localPart.startsWith(p));
  });

  return (personal ?? matches[0]).toLowerCase();
}
