import type { User } from "../../drizzle/schema";

export function publicUser(user: User | null) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role, papel: user.papel } : null;
}
