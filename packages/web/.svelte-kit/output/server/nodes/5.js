import * as server from '../entries/pages/dashboard/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/dashboard/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/dashboard/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.wvg9piEg.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/Be4V9gEW.js","_app/immutable/chunks/DY-TDQRa.js","_app/immutable/chunks/OCiKhNqo.js"];
export const stylesheets = ["_app/immutable/assets/5.DNnHtQoZ.css"];
export const fonts = [];
