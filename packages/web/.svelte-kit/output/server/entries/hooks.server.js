import { d as validateSession } from "../chunks/db.js";
const handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get("iscn_session");
  if (!sessionId || !event.platform) {
    event.locals.session = null;
    event.locals.user = null;
    return await resolve(event);
  }
  const session = await validateSession(event.platform.env.DB, sessionId);
  if (!session) {
    event.cookies.delete("iscn_session", { path: "/" });
    event.locals.session = null;
    event.locals.user = null;
    return await resolve(event);
  }
  const user = await event.platform.env.DB.prepare("SELECT * FROM user WHERE id = ?").bind(session.user_id).first();
  if (!user) {
    event.cookies.delete("iscn_session", { path: "/" });
    event.locals.session = null;
    event.locals.user = null;
    return await resolve(event);
  }
  event.locals.session = session;
  event.locals.user = user;
  return await resolve(event);
};
export {
  handle
};
