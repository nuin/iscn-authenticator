import * as server from '../entries/pages/dashboard/billing/_page.server.ts.js';

export const index = 7;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/billing/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/dashboard/billing/+page.server.ts";
export const imports = ["_app/immutable/nodes/7.Ca22NVJ8.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/Be4V9gEW.js","_app/immutable/chunks/DY-TDQRa.js","_app/immutable/chunks/CCPeUkzG.js","_app/immutable/chunks/CC7cJugI.js","_app/immutable/chunks/DXXIrBtA.js","_app/immutable/chunks/OCiKhNqo.js"];
export const stylesheets = ["_app/immutable/assets/7.BmBtJQg6.css"];
export const fonts = [];
