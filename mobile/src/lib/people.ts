interface Person {
  email: string;
  full_name?: string | null;
}

/** Name when set, else email — same rule as the web app. */
export const displayName = (p: Person): string => p.full_name?.trim() || p.email;
