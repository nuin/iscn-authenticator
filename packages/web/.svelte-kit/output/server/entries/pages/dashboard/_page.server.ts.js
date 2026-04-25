import { redirect } from "@sveltejs/kit";
const load = async ({ locals, platform }) => {
  const now = /* @__PURE__ */ new Date();
  const month = now.getUTCFullYear().toString() + (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const used = 0;
  const limit = locals.user.plan === "pro" ? 1e5 : 1e3;
  return {
    usage: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      month
    }
  };
};
const actions = {
  logout: async ({ cookies, platform }) => {
    const sessionId = cookies.get("iscn_session");
    if (sessionId && platform) {
      await platform.env.DB.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run();
    }
    cookies.delete("iscn_session", { path: "/" });
    throw redirect(302, "/login");
  }
};
export {
  actions,
  load
};
