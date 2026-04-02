export interface PublicUser {
  id: number;
  email: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
}

export function getUserDisplayName(user: Pick<PublicUser, "displayName" | "username" | "email">) {
  return user.displayName || user.username || user.email;
}
