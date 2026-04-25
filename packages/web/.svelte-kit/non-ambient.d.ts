
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/about" | "/api" | "/api/explain" | "/api/explain/miss" | "/api/webhooks" | "/api/webhooks/stripe" | "/dashboard" | "/dashboard/batch" | "/dashboard/billing" | "/dashboard/keys" | "/docs" | "/explain" | "/explain/[signature]" | "/login" | "/pricing" | "/privacy" | "/signup" | "/terms";
		RouteParams(): {
			"/explain/[signature]": { signature: string }
		};
		LayoutParams(): {
			"/": { signature?: string };
			"/about": Record<string, never>;
			"/api": Record<string, never>;
			"/api/explain": Record<string, never>;
			"/api/explain/miss": Record<string, never>;
			"/api/webhooks": Record<string, never>;
			"/api/webhooks/stripe": Record<string, never>;
			"/dashboard": Record<string, never>;
			"/dashboard/batch": Record<string, never>;
			"/dashboard/billing": Record<string, never>;
			"/dashboard/keys": Record<string, never>;
			"/docs": Record<string, never>;
			"/explain": { signature?: string };
			"/explain/[signature]": { signature: string };
			"/login": Record<string, never>;
			"/pricing": Record<string, never>;
			"/privacy": Record<string, never>;
			"/signup": Record<string, never>;
			"/terms": Record<string, never>
		};
		Pathname(): "/" | "/about" | "/api/explain/miss" | "/api/webhooks/stripe" | "/dashboard" | "/dashboard/batch" | "/dashboard/billing" | "/dashboard/keys" | "/docs" | "/explain" | `/explain/${string}` & {} | "/login" | "/pricing" | "/privacy" | "/signup" | "/terms";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/.gitkeep" | string & {};
	}
}