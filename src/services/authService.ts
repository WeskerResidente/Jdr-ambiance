import { API_URL } from "../config/api";
import { LocalUser } from "../types/audio";
import { storageService } from "./storageService";

type AuthResponse = {
  user: LocalUser;
  token: string;
};

const TEST_ACCOUNT_EMAIL = "test@test.com";
const TEST_ACCOUNT_PASSWORD = "test12345";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateCredentials(email: string, password: string) {
  const cleanEmail = normalizeEmail(email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Entre une adresse email valide.");
  }

  if (password.length < 8) {
    throw new Error("Utilise au moins 8 caracteres.");
  }

  return cleanEmail;
}

function isTestAccount(email: string, password: string) {
  return normalizeEmail(email) === TEST_ACCOUNT_EMAIL && password === TEST_ACCOUNT_PASSWORD;
}

async function persistTestUser(): Promise<LocalUser> {
  const user: LocalUser = {
    id: "local-test-user",
    email: TEST_ACCOUNT_EMAIL,
    createdAt: new Date().toISOString()
  };

  await storageService.saveAuthToken(null);
  await storageService.saveLocalUser(user);
  return user;
}

async function persistLocalFallbackUser(email: string): Promise<LocalUser> {
  const existingUser = await storageService.getLocalUser();
  const user: LocalUser = {
    id: `local-${email}`,
    email,
    createdAt: existingUser?.email === email ? existingUser.createdAt : new Date().toISOString()
  };

  await storageService.saveAuthToken(null);
  await storageService.saveLocalUser(user);
  return user;
}

async function authenticateTestAccount() {
  if (!API_URL) return persistTestUser();

  let loginError: unknown;

  try {
    const payload = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ACCOUNT_EMAIL, password: TEST_ACCOUNT_PASSWORD })
    });
    return persistSession(payload);
  } catch (error) {
    loginError = error;

    try {
      const payload = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: TEST_ACCOUNT_EMAIL, password: TEST_ACCOUNT_PASSWORD })
      });
      return persistSession(payload);
    } catch (registerError) {
      throw registerError instanceof Error ? registerError : loginError;
    }
  }
}

function requireApiUrl() {
  if (!API_URL) {
    throw new Error("Configure EXPO_PUBLIC_API_URL dans le fichier .env pour activer l'authentification.");
  }

  return API_URL;
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? "Requete refusee par le serveur.";
  } catch {
    return "Requete refusee par le serveur.";
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = requireApiUrl();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new Error("Impossible de joindre le serveur d'authentification. Verifie que l'API est en ligne et en HTTPS si le site web est en HTTPS.");
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

async function persistSession(payload: AuthResponse) {
  await storageService.saveAuthToken(payload.token);
  await storageService.saveLocalUser(payload.user);
  return payload.user;
}

export const authService = {
  async signup(email: string, password: string) {
    if (isTestAccount(email, password)) return authenticateTestAccount();

    const cleanEmail = validateCredentials(email, password);
    let payload: AuthResponse;

    try {
      payload = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password })
      });
    } catch (error) {
      if (API_URL) throw error;
      return persistLocalFallbackUser(cleanEmail);
    }

    return persistSession(payload);
  },

  async login(email: string, password: string) {
    if (isTestAccount(email, password)) return authenticateTestAccount();

    const cleanEmail = validateCredentials(email, password);
    let payload: AuthResponse;

    try {
      payload = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password })
      });
    } catch (error) {
      if (API_URL) throw error;
      return persistLocalFallbackUser(cleanEmail);
    }

    return persistSession(payload);
  },

  async restoreSession() {
    const token = await storageService.getAuthToken();
    if (!token) return null;

    try {
      const user = await apiRequest<LocalUser>("/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      await storageService.saveLocalUser(user);
      return user;
    } catch {
      await storageService.saveAuthToken(null);
      await storageService.saveLocalUser(null);
      return null;
    }
  },

  async signOut() {
    const token = await storageService.getAuthToken();

    if (token && API_URL) {
      try {
        await apiRequest<{ ok: boolean }>("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch {
        // Local sign-out must still succeed if the API is offline.
      }
    }

    await storageService.saveAuthToken(null);
    await storageService.saveLocalUser(null);
  }
};
