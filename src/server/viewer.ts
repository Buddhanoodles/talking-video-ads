import { isAdmin } from "@every-app/sdk/server";
import type { Viewer } from "@/server/actors";
import { rememberUser } from "@/server/users";

/** The signed-in member as the queries take them, recorded on first sight. */
export async function viewerOf(user: {
  id: string;
  email: string;
  orgRole: string;
}): Promise<Viewer> {
  await rememberUser(user);
  return { id: user.id, admin: isAdmin(user) };
}
