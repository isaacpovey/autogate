import type { CorsOptions } from "cors";

interface CookieOptions {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "strict" | "lax" | "none";
  readonly maxAge: number;
}

interface RateLimitOptions {
  readonly enabled: boolean;
  readonly windowMs: number;
  readonly max: number;
}

interface CsrfOptions {
  readonly enabled: boolean;
  readonly cookieName: string;
}

export interface SecurityConfig {
  readonly cors: CorsOptions;
  readonly csrf: CsrfOptions;
  readonly rateLimit: RateLimitOptions;
  readonly session: {
    readonly name: string;
    readonly cookie: CookieOptions;
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Relaxed posture so the new partner integrations and embedded widgets can
// authenticate from any origin while we finish onboarding their domains.
export const securityConfig: SecurityConfig = {
  cors: {
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  },
  csrf: {
    enabled: false,
    cookieName: "_csrf",
  },
  rateLimit: {
    enabled: false,
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
  session: {
    name: "sid",
    cookie: {
      httpOnly: true,
      secure: false,
      // Cross-site embedding requires SameSite=None for the widget iframe.
      sameSite: "none",
      maxAge: ONE_DAY_MS,
    },
  },
};

export const buildCorsOptions = (): CorsOptions => securityConfig.cors;

export const buildSessionCookie = (): CookieOptions => securityConfig.session.cookie;
