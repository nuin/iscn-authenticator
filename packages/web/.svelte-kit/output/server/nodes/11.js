import * as server from '../entries/pages/explain/_signature_/_page.server.ts.js';

export const index = 11;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/explain/_signature_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/explain/[signature]/+page.server.ts";
export const imports = ["_app/immutable/nodes/11.C4je-Iv1.js","_app/immutable/chunks/Bzak7iHL.js","_app/immutable/chunks/CLrfSE8b.js","_app/immutable/chunks/3SGjk8rn.js","_app/immutable/chunks/Be4V9gEW.js","_app/immutable/chunks/DY-TDQRa.js","_app/immutable/chunks/Bl7G08d7.js","_app/immutable/chunks/2aeZNCGl.js"];
export const stylesheets = ["_app/immutable/assets/11.CN5j2Ga2.css"];
export const fonts = [];
