import { cookies } from "next/headers";
import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

export const SESSION_COOKIE = "guest_session_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function getOrCreateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const { data: session } = await supabase
      .from("guest_sessions")
      .select("*")
      .eq("sessionToken", token)
      .maybeSingle();

    if (session && new Date(session.expiresAt) > new Date()) {
      return { session, isNew: false };
    }
  }

  const newToken = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  const { data: session } = await supabase
    .from("guest_sessions")
    .insert({ id: uuidv4(), sessionToken: newToken, expiresAt })
    .select()
    .single();

  return { session, isNew: true, newToken };
}

export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session } = await supabase
    .from("guest_sessions")
    .select("id, expiresAt")
    .eq("sessionToken", token)
    .maybeSingle();

  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  return session.id;
}
