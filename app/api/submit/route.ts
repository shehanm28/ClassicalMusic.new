import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const ALLOWED_GENRES = [
  "Keyboard",
  "Chamber",
  "Orchestra",
  "Ballet",
  "Opera",
  "Choral",
  "Electroacoustic",
  "World",
  "Other",
];

const MAX_DESCRIPTION = 280;
const MAX_NAME = 100;
const MAX_OTHER_GENRE = 100;
const MAX_EMAIL = 254;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limiter (resets on redeploy)
const ipTimestamps = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  ipTimestamps.set(ip, recent);

  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  ipTimestamps.set(ip, recent);
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function sendToKit(params: {
  email: string;
  name: string | undefined;
  description: string;
  resolvedGenre: string;
}): Promise<boolean> {
  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    console.warn("Kit env vars missing; skipping Kit integration.");
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Kit-Api-Key": apiKey,
  };

  // Step 1: Create or update subscriber with custom fields
  const createRes = await fetch("https://api.kit.com/v4/subscribers", {
    method: "POST",
    headers,
    body: JSON.stringify({
      first_name: params.name ?? "",
      email_address: params.email,
      fields: {
        "Piece Idea": params.description,
        Genre: params.resolvedGenre,
        Source: "classicalmusic.new",
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    console.error("Kit create subscriber failed:", createRes.status, text);
    return false;
  }

  // Step 2: Add subscriber to form (triggers incentive email)
  const addRes = await fetch(
    `https://api.kit.com/v4/forms/${encodeURIComponent(formId)}/subscribers`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ email_address: params.email }),
    }
  );

  if (!addRes.ok) {
    const text = await addRes.text().catch(() => "");
    console.error("Kit add to form failed:", addRes.status, text);
    return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { description, genre, otherGenre, email, name } = body;

    // Validate description
    if (
      typeof description !== "string" ||
      description.trim().length === 0 ||
      description.trim().length > MAX_DESCRIPTION
    ) {
      return NextResponse.json(
        { error: `Description must be 1–${MAX_DESCRIPTION} characters.` },
        { status: 400 }
      );
    }

    // Validate genre
    if (typeof genre !== "string" || !ALLOWED_GENRES.includes(genre)) {
      return NextResponse.json(
        { error: "Invalid genre selection." },
        { status: 400 }
      );
    }

    // Validate otherGenre when genre is "Other"
    if (genre === "Other") {
      if (
        typeof otherGenre !== "string" ||
        otherGenre.trim().length === 0 ||
        otherGenre.trim().length > MAX_OTHER_GENRE
      ) {
        return NextResponse.json(
          {
            error: `Please specify a genre (1–${MAX_OTHER_GENRE} characters).`,
          },
          { status: 400 }
        );
      }
    }

    // Validate email
    if (
      typeof email !== "string" ||
      email.trim().length === 0 ||
      email.trim().length > MAX_EMAIL ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Validate name (optional)
    if (name !== undefined && name !== null) {
      if (typeof name !== "string" || name.trim().length > MAX_NAME) {
        return NextResponse.json(
          { error: `Name must be at most ${MAX_NAME} characters.` },
          { status: 400 }
        );
      }
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const resolvedGenre =
      genre === "Other" ? otherGenre.trim() : genre;
    const trimmedName =
      name && typeof name === "string" && name.trim() ? name.trim() : "";
    const resolvedName = trimmedName || "Anonymous";
    const trimmedEmail = email.trim();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:E",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            resolvedName,
            resolvedGenre,
            description.trim(),
            trimmedEmail,
          ],
        ],
      },
    });

    // Kit integration is best-effort; sheet row is the source of truth
    let emailSent = false;
    try {
      emailSent = await sendToKit({
        email: trimmedEmail,
        name: trimmedName || undefined,
        description: description.trim(),
        resolvedGenre,
      });
    } catch (kitError) {
      console.error("Kit integration error:", kitError);
    }

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json(
      { error: "Failed to save submission. Please try again." },
      { status: 500 }
    );
  }
}
