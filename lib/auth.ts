import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type ManagerRole = 'manager' | 'admin';

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod'
  );

export async function createManagerToken(role: ManagerRole = 'manager'): Promise<string> {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function getManagerSession(): Promise<{ role: ManagerRole } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('manager_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role === 'manager' || payload.role === 'admin') {
      return { role: payload.role as ManagerRole };
    }
    return null;
  } catch {
    return null;
  }
}

// Returns the matched role, or null if no password matches
export function checkManagerPassword(password: string): ManagerRole | null {
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return 'manager';
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return 'admin';
  return null;
}
