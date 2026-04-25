import * as server from '../entries/pages/dashboard/_layout.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/dashboard/+layout.server.ts";
export const imports = ["_app/immutable/nodes/2.CGnR9ubC.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/BaPUBt2x.js","_app/immutable/chunks/DY-TDQRa.js","_app/immutable/chunks/Be4V9gEW.js","_app/immutable/chunks/OCiKhNqo.js","_app/immutable/chunks/DEe3tSS8.js","_app/immutable/chunks/CC7cJugI.js","_app/immutable/chunks/DXXIrBtA.js"];
export const stylesheets = ["_app/immutable/assets/2.Dhw_LrcX.css"];
export const fonts = [];
