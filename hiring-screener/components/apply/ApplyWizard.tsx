"use client";

import { useState } from "react";
import { LOCATION_CHOICES, ROLES, ROLE_LIST, type LocationChoice, type Role } from "@/lib/roles";
import { ProgressBar } from "./ProgressBar";

const MAX_CV_SIZE = 3 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

export function ApplyWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);

  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [locationChoice, setLocationChoice] = useState<LocationChoice | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cvWarning, setCvWarning] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function selectRole(r: Role) {
    setRole(r);
    setAnswers({});
    setLocationChoice("");
    setStep(2);
  }

  function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCvError(null);
    if (!file) {
      setCvFile(null);
      return;
    }
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
      setCvError("Please upload a PDF or DOC/DOCX file.");
      setCvFile(null);
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      setCvError("File is too large. Max size is 3MB.");
      setCvFile(null);
      return;
    }
    setCvFile(file);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-stone-950">Application received</h1>
        <p className="mt-3 text-stone-600">
          Thanks for applying to Yellow.ai&apos;s Forward Deployed team. We&apos;ll be in touch if
          there&apos;s a fit.
        </p>
        {cvWarning && <p className="mt-4 text-sm text-amber-dark">{cvWarning}</p>}
      </div>
    );
  }

  if (step === 1 || !role) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ProgressBar step={1} totalSteps={2} />
        <h1 className="text-2xl font-semibold text-stone-950">Apply to Yellow.ai</h1>
        <p className="mt-2 text-stone-600">Which Forward Deployed role are you applying for?</p>

        <div className="mt-8 flex flex-col gap-4">
          {ROLE_LIST.map((r) => (
            <button
              key={r.key}
              onClick={() => selectRole(r.key)}
              className="group rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="block font-medium text-stone-950">{r.title}</span>
                  <span className="mt-1 block text-sm text-stone-500 line-clamp-2">{r.criteria}</span>
                </div>
                <span className="mt-0.5 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-amber-dark">
                  →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const config = ROLES[role];
  const requiredFieldsFilled =
    name.trim().length > 0 &&
    config.questions.every((q) => Boolean(answers[q.id])) &&
    freeText.trim().length > 0 &&
    (!config.hasLocationChoice || Boolean(locationChoice));

  async function handleSubmit() {
    if (!role || !requiredFieldsFilled || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setCvWarning(null);

    let cvUrl: string | undefined;
    let cvFilename: string | undefined;

    if (cvFile) {
      try {
        const formData = new FormData();
        formData.append("file", cvFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("upload failed");
        const uploadData = await uploadRes.json();
        cvUrl = uploadData.url;
        cvFilename = uploadData.filename;
      } catch {
        setCvWarning(
          "We couldn't upload your CV, but your application was still submitted. Feel free to email your CV separately."
        );
      }
    }

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name: name.trim(),
          linkedin: linkedin.trim() || undefined,
          locationChoice: config.hasLocationChoice ? locationChoice || undefined : undefined,
          answers: config.questions.map((q) => ({ id: q.id, answer: answers[q.id] })),
          freeText: freeText.trim(),
          cvUrl,
          cvFilename,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submission failed");
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <ProgressBar step={2} totalSteps={2} />

      <button
        onClick={() => setStep(1)}
        className="mb-4 text-sm text-stone-500 hover:text-stone-800"
      >
        ← Change role
      </button>

      <h1 className="text-2xl font-semibold text-stone-950">{config.title}</h1>

      {config.wfoBanner && (
        <div className="mt-4 rounded-md border border-amber bg-amber/10 px-4 py-3 text-sm text-stone-800">
          {config.wfoBanner}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-800">
            Name <span className="text-amber-dark">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-800">LinkedIn URL</label>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-800">
            CV / Resume <span className="text-stone-400">(PDF or DOC, max 3MB)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleCvChange}
            className="w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200"
          />
          {cvError && <p className="mt-1 text-sm text-red-600">{cvError}</p>}
        </div>

        {config.hasLocationChoice && (
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-800">
              Location <span className="text-amber-dark">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {LOCATION_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer flex-col rounded-md border px-4 py-3 ${
                    locationChoice === choice.value
                      ? "border-amber bg-amber/10"
                      : "border-stone-200"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="locationChoice"
                      checked={locationChoice === choice.value}
                      onChange={() => setLocationChoice(choice.value)}
                      className="accent-amber"
                    />
                    {choice.label}
                  </span>
                  {choice.note && locationChoice === choice.value && (
                    <span className="mt-2 text-sm text-stone-600">{choice.note}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {config.questions.map((q) => (
          <div key={q.id}>
            <label className="mb-2 block text-sm font-medium text-stone-800">
              {q.question} <span className="text-amber-dark">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {q.options.map((option) => (
                <label
                  key={option.label}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 ${
                    answers[q.id] === option.label ? "border-amber bg-amber/10" : "border-stone-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === option.label}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: option.label }))}
                    className="accent-amber"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-800">
            {config.freeTextQuestion} <span className="text-amber-dark">*</span>
          </label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          onClick={handleSubmit}
          disabled={!requiredFieldsFilled || submitting}
          className="w-full rounded-md bg-amber px-6 py-3 font-medium text-stone-950 transition hover:bg-amber-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {submitting ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </div>
  );
}
