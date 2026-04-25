import { redirect } from "@sveltejs/kit";
const load = async ({ locals }) => {
  if (!locals.session || !locals.user) {
    throw redirect(302, "/login");
  }
  return {
    user: locals.user
  };
};
export {
  load
};
