import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { authConfig } from './auth.config';
import { sqlClient } from '@/app/lib/db';

async function getUser(email: string): Promise<User | undefined> {
  try {
    if (sqlClient) {
      const user = await sqlClient`SELECT * FROM users WHERE email=${email}`;
      if (user && user.length > 0) return user[0];
    }
  } catch (error) {
    console.error('Database query error in getUser:', error);
  }

  // In stateless mode without a database, authenticate demo user only if configured securely via environment
  if (
    process.env.DEMO_USER_EMAIL &&
    process.env.DEMO_USER_PASSWORD &&
    email.toLowerCase() === process.env.DEMO_USER_EMAIL.toLowerCase()
  ) {
    return {
      id: '410544b2-4001-4271-9855-fec4b6a6442a',
      name: 'Demo User',
      email: process.env.DEMO_USER_EMAIL,
      password: await bcrypt.hash(process.env.DEMO_USER_PASSWORD, 10),
    };
  }

  return undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          const user = await getUser(email);
          if (!user) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
        }

        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
