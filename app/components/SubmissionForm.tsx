"use client";

import { useState, FormEvent } from "react";

const GENRES = [
  "Keyboard",
  "Chamber",
  "Orchestra",
  "Ballet",
  "Opera",
  "Choral",
  "Electroacoustic",
  "World",
  "Other",
] as const;

type Genre = (typeof GENRES)[number];

const MAX_DESCRIPTION = 280;
const MAX_NAME = 100;
const MAX_OTHER_GENRE = 100;
const MAX_EMAIL = 254;

export default function SubmissionForm() {
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState<Genre | "">("");
  const [otherGenre, setOtherGenre] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [emailSent, setEmailSent] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!description.trim() || !genre || !email.trim()) return;
    if (genre === "Other" && !otherGenre.trim()) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          genre,
          otherGenre: genre === "Other" ? otherGenre.trim() : undefined,
          email: email.trim(),
          name: name.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        setEmailSent(data?.emailSent !== false);
        setStatus("success");
      } else {
        const data = await res.json().catch(() => null);
        setErrorMessage(
          data?.error || (res.status === 429 ? "Too many submissions. Please try again later." : "Something went wrong. Please try again.")
        );
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-border bg-success-bg p-8 text-center">
        <p className="font-serif text-xl font-semibold">
          Your idea has been submitted!
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          {emailSent ? (
            <>Check your inbox – we sent you a receipt with your idea.</>
          ) : (
            <>
              We&apos;ve saved your idea. Your receipt email may be delayed –
              keep an eye on your inbox.
            </>
          )}
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          We&apos;ll keep you posted around once a month on how the
          commissioning is going, and we&apos;ll let you know if we commission
          your work.
        </p>
        <button
          type="button"
          onClick={() => {
            setDescription("");
            setGenre("");
            setOtherGenre("");
            setEmail("");
            setName("");
            setEmailSent(true);
            setStatus("idle");
          }}
          className="mt-6 text-sm font-medium text-accent underline underline-offset-4 hover:text-foreground"
        >
          Submit another idea
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium"
        >
          Your piece idea <span className="text-accent">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value.slice(0, MAX_DESCRIPTION))
          }
          placeholder="A cello concerto that sounds like the feeling of reading a letter from an old friend..."
          rows={3}
          maxLength={MAX_DESCRIPTION}
          required
          className="w-full resize-none rounded-lg border border-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {description.length}/{MAX_DESCRIPTION}
        </p>
      </div>

      {/* Genre */}
      <div>
        <label htmlFor="genre" className="mb-1.5 block text-sm font-medium">
          Genre <span className="text-accent">*</span>
        </label>
        <select
          id="genre"
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value as Genre | "");
            if (e.target.value !== "Other") setOtherGenre("");
          }}
          required
          className="w-full appearance-none rounded-lg border border-border bg-input-bg px-4 py-3 text-foreground focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        >
          <option value="" disabled>
            Select a genre...
          </option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Other Genre */}
      {genre === "Other" && (
        <div>
          <label
            htmlFor="otherGenre"
            className="mb-1.5 block text-sm font-medium"
          >
            Specify genre <span className="text-accent">*</span>
          </label>
          <input
            id="otherGenre"
            type="text"
            value={otherGenre}
            onChange={(e) =>
              setOtherGenre(e.target.value.slice(0, MAX_OTHER_GENRE))
            }
            placeholder="e.g., Minimalist, Jazz-influenced..."
            maxLength={MAX_OTHER_GENRE}
            required
            className="w-full rounded-lg border border-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
          />
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Your email <span className="text-accent">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.slice(0, MAX_EMAIL))}
          placeholder="you@example.com"
          maxLength={MAX_EMAIL}
          autoComplete="email"
          required
          className="w-full rounded-lg border border-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          We&apos;ll only email you a receipt and occasional updates
          (~monthly). Unsubscribe anytime.
        </p>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Your name or alias{" "}
          <span className="text-xs font-normal text-muted">(optional)</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
          placeholder="Anonymous"
          maxLength={MAX_NAME}
          className="w-full rounded-lg border border-border bg-input-bg px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        />
      </div>

      {/* Error */}
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting..." : "Submit your idea"}
      </button>
    </form>
  );
}
