import * as server from '../entries/pages/explain/_page.server.ts.js';

export const index = 10;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/explain/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/explain/+page.server.ts";
export const imports = ["_app/immutable/nodes/10.Dxyhc8P3.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/Bl7G08d7.js","_app/immutable/chunks/2aeZNCGl.js"];
export const stylesheets = ["_app/immutable/assets/10.DGBmQJsm.css"];
export const fonts = [];
