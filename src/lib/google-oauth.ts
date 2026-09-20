import { env } from "../config/env.js";

export type GoogleOauthPurpose = "calendar" | "drive";

const SCOPES: Record<GoogleOauthPurpose, string[]> = {
  calendar: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  drive: ["openid", "email", "https://www.googleapis.com/auth/drive.file"],
};

export class GoogleOauthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GoogleOauthError";
  }
}

/** Everything Google is env-gated — no bundled credentials. */
export function isGoogleConfigured(): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID?.trim() &&
      env.GOOGLE_CLIENT_SECRET?.trim() &&
      env.GOOGLE_REDIRECT_URI?.trim(),
  );
}

export function googleScopes(purpose: GoogleOauthPurpose): string[] {
  return SCOPES[purpose];
}

export function buildGoogleAuthUrl(input: {
  purpose: GoogleOauthPurpose;
  state: string;
}): string {
  if (!isGoogleConfigured()) {
    throw new GoogleOauthError("Google is not configured on this server.", 503);
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: env.GOOGLE_REDIRECT_URI!.trim(),
    response_type: "code",
    scope: googleScopes(input.purpose).join(" "),
    // Offline + consent so a refresh token comes back on every re-link.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  email: string | null;
  expiresInSeconds: number | null;
}

function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenSet> {
  if (!isGoogleConfigured()) {
    throw new GoogleOauthError("Google is not configured on this server.", 503);
  }

  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: env.GOOGLE_REDIRECT_URI!.trim(),
        grant_type: "authorization_code",
      }).toString(),
    });
  } catch (error) {
    console.error("Google token exchange failed.", error);
    throw new GoogleOauthError("Unable to reach Google right now.", 503);
  }

  const text = await response.text();
  if (!response.ok) {
    console.error("Google rejected the token exchange.", response.status, text);
    throw new GoogleOauthError("Google rejected this authorization.", 502);
  }

  let payload: {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    id_token?: string;
  };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new GoogleOauthError("Unexpected Google response.", 502);
  }

  if (!payload.access_token) {
    throw new GoogleOauthError("Google returned no access token.", 502);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    scope: payload.scope ?? null,
    email: emailFromIdToken(payload.id_token),
    expiresInSeconds: payload.expires_in ?? null,
  };
}
