// Mock auth - will be replaced with Supabase auth when backend is ready

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
};

export type Workspace = {
  id: string;
  name: string;
  openclawUrl: string;
  openclawToken: string;
};

const STORAGE_KEY = "commandmate_user";
const WORKSPACE_KEY = "commandmate_workspace";
const ONBOARDED_KEY = "commandmate_onboarded";

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getStoredWorkspace(): Workspace | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(WORKSPACE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setStoredWorkspace(ws: Workspace | null) {
  if (!ws) {
    localStorage.removeItem(WORKSPACE_KEY);
    return;
  }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDED_KEY) === "true";
}

export function setOnboarded(val: boolean) {
  localStorage.setItem(ONBOARDED_KEY, val ? "true" : "false");
}

export async function mockLogin(email: string, _password: string): Promise<User> {
  await new Promise(r => setTimeout(r, 800));
  const user: User = { id: crypto.randomUUID(), email, name: email.split("@")[0] };
  setStoredUser(user);
  return user;
}

export async function mockSignup(email: string, _password: string): Promise<User> {
  await new Promise(r => setTimeout(r, 800));
  const user: User = { id: crypto.randomUUID(), email, name: email.split("@")[0] };
  setStoredUser(user);
  setOnboarded(false);
  return user;
}

export function mockLogout() {
  setStoredUser(null);
  setStoredWorkspace(null);
  localStorage.removeItem(ONBOARDED_KEY);
}
