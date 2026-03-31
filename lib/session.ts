import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { v4 as uuidv4 } from "uuid";

const SESSION_COOKIE = "guest_session_token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export async function getOrCreateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const session = await prisma.guestSession.findUnique({
      where: { sessionToken: token },
    });
    if (session && session.expiresAt > new Date()) {
      return { session, isNew: false };
    }
  }

  const newToken = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  const session = await prisma.guestSession.create({
    data: {
      sessionToken: newToken,
      expiresAt,
    },
  });

  return { session, isNew: true, newToken };
}

export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.guestSession.findUnique({
    where: { sessionToken: token },
  });

  if (!session || session.expiresAt <= new Date()) return null;
  return session.id;
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
