import { fail, redirect } from "@sveltejs/kit";
import { g as getUserByEmail, b as createUser, c as createKey, a as createSession } from "../../../chunks/db.js";
const load = async ({ locals }) => {
  if (locals.session) {
    throw redirect(302, "/dashboard");
  }
};
const actions = {
  default: async ({ request, platform, cookies }) => {
    if (!platform) {
      return fail(500, { message: "Platform not available" });
    }
    const formData = await request.formData();
    const email = formData.get("email")?.toString().trim();
    if (!email) {
      return fail(400, { email, error: "Email is required" });
    }
    if (!isPlausibleEmail(email)) {
      return fail(400, { email, error: "Invalid email address" });
    }
    const existing = await getUserByEmail(platform.env.DB, email);
    if (existing) {
      return fail(400, { email, error: "Email already registered" });
    }
    const user = await createUser(platform.env.DB, email);
    const { record: keyRecord, plaintext } = await createKey(platform.env.DB, user.id, "Initial key");
    const session = await createSession(platform.env.DB, user.id);
    cookies.set("iscn_session", session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      // Pages is always HTTPS
      maxAge: 60 * 60 * 24 * 30
      // 30 days
    });
    return {
      success: true,
      email: user.email,
      plaintext,
      keyId: keyRecord.id
    };
  }
};
function isPlausibleEmail(email) {
  return email.includes("@") && email.includes(".") && email.length > 5;
}
export {
  actions,
  load
};
