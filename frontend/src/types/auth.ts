// django-allauth headless API ("browser" client) response shapes we rely on.
export type AuthUser = { id: number; email: string; display: string; has_usable_password: boolean };

export type AuthFlow = { id: string; provider?: { id: string; name: string }; is_pending?: boolean };

export type AuthErrorItem = { message: string; code: string; param?: string };

export type AuthResponse = {
  status: number;
  data?: { user?: AuthUser; flows?: AuthFlow[] };
  meta?: { is_authenticated?: boolean };
  errors?: AuthErrorItem[];
};

export type SocialProvider = { id: string; name: string; flows: string[] };

export type AuthConfig = {
  status: number;
  data: {
    account: { is_open_for_signup?: boolean; email_verification_by_code_enabled?: boolean };
    socialaccount?: { providers: SocialProvider[] };
  };
};

export type Session =
  | { isAuthenticated: true; user: AuthUser }
  | { isAuthenticated: false; pendingFlow?: string };
