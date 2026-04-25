import { redirect } from "@sveltejs/kit";
const load = async ({ locals }) => {
  return {};
};
const actions = {
  upgrade: async ({ locals, platform }) => {
    if (!locals.user || !platform) throw redirect(302, "/login");
    return {
      message: "Stripe integration is pending environment variables configuration."
    };
  },
  manage: async ({ locals, platform }) => {
    if (!locals.user || !platform) throw redirect(302, "/login");
    return {
      message: "Stripe integration is pending environment variables configuration."
    };
  }
};
export {
  actions,
  load
};
