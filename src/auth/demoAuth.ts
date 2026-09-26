/**
 * Demo Auth — Simulates authentication for the frontend-only build.
 * 
 * When the backend is deployed, replace this with real HTTP calls.
 * The UI code doesn't change — only the implementation of these functions.
 */

const DEMO_USER_KEY = 'amigo_demo_user';

export interface DemoUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthState {
  user: DemoUser | null;
  isAuthenticated: boolean;
}

export function getDemoAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(DEMO_USER_KEY);
    if (stored) {
      const user = JSON.parse(stored) as DemoUser;
      return { user, isAuthenticated: true };
    }
  } catch {
    // Ignore parse errors
  }
  return { user: null, isAuthenticated: false };
}

export async function demoLogin(email: string, _password: string): Promise<AuthState> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // In demo mode, any email/password combo works (min 8 chars for password)
  if (_password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const user: DemoUser = {
    id: 'demo-user-' + email.replace(/[^a-z0-9]/gi, ''),
    email,
    displayName: email.split('@')[0],
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  return { user, isAuthenticated: true };
}

export async function demoGuestLogin(displayName: string): Promise<AuthState> {
  const name = displayName.trim();
  if (!name) {
    throw new Error('Please enter your name');
  }

  const user: DemoUser = {
    id: 'demo-user-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    email: '',
    displayName: name,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  return { user, isAuthenticated: true };
}

export async function demoRegister(
  email: string,
  _password: string,
  displayName: string
): Promise<AuthState> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (_password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const user: DemoUser = {
    id: 'demo-user-' + email.replace(/[^a-z0-9]/gi, ''),
    email,
    displayName,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  return { user, isAuthenticated: true };
}

export async function demoLogout(): Promise<void> {
  localStorage.removeItem(DEMO_USER_KEY);
}
