import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "./auth";

export function isAdminAuthenticated(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
