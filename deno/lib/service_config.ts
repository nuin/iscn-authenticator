export interface ServiceConfig {
  publicApiOrigin: string;
  axiomEndpoint: string;
  scalarCdnUrl: string;
}

/** Deployment URLs can be overridden without changing request handlers. */
export function loadServiceConfig(): ServiceConfig {
  return {
    publicApiOrigin: getenv("PUBLIC_API_ORIGIN", "https://your-host.example.com"),
    axiomEndpoint: getenv("AXIOM_ENDPOINT", "https://api.axiom.co/v1/datasets"),
    scalarCdnUrl: getenv("SCALAR_CDN_URL", "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"),
  };
}

function getenv(name: string, defaultValue: string): string {
  return Deno.env.get(name) || defaultValue;
}
