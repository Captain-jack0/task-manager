interface Person {
  email: string;
  full_name?: string | null;
}

/** What to show for a user: their name when they have one, else the email. */
export const displayName = (p: Person): string => p.full_name?.trim() || p.email;

/** Single-letter avatar text. */
export const initial = (p: Person): string => displayName(p).charAt(0).toUpperCase() || '?';
