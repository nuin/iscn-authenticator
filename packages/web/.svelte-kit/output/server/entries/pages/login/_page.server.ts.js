import { fail, redirect } from "@sveltejs/kit";
import { v as validateKey, a as createSession } from "../../../chunks/db.js";
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
    const apiKey = formData.get("api_key")?.toString().trim();
    if (!apiKey) {
      return fail(400, { error: "Please provide an API key." });
    }
    const keyRecord = await validateKey(platform.env.DB, apiKey);
    if (!keyRecord || !keyRecord.user_id) {
      return fail(401, {
        error: "This key is not valid for dashboard access (it may be revoked or internal)."
      });
    }
    const session = await createSession(platform.env.DB, keyRecord.user_id);
    cookies.set("iscn_session", session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30
      // 30 days
    });
    throw redirect(302, "/dashboard");
  }
};
export {
  actions,
  load
};
