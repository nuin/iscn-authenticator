import * as server from '../entries/pages/dashboard/keys/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/keys/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/dashboard/keys/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.B4EDNAj-.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/Be4V9gEW.js","_app/immutable/chunks/DY-TDQRa.js","_app/immutable/chunks/Bl7G08d7.js","_app/immutable/chunks/CCPeUkzG.js","_app/immutable/chunks/CC7cJugI.js","_app/immutable/chunks/DXXIrBtA.js","_app/immutable/chunks/2aeZNCGl.js","_app/immutable/chunks/OCiKhNqo.js"];
export const stylesheets = ["_app/immutable/assets/8.BQ_fgotX.css"];
export const fonts = [];
