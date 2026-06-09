import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Initialisation paresseuse du client Supabase pour éviter les erreurs
// d'importation pendant la pré-génération quand les variables d'environnement
// ne sont pas disponibles. Le Proxy crée le client à la première utilisation.
let _client: ReturnType<typeof createClient> | null = null;

function ensureClient() {
	if (_client) return _client;
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
	}
	if (typeof window !== 'undefined') {
		_client = createBrowserClient(supabaseUrl, supabaseAnonKey);
	} else {
		_client = createClient(supabaseUrl, supabaseAnonKey);
	}
	return _client;
}

export const supabase: any = new Proxy(
	{},
	{
		get(_, prop) {
			const client = ensureClient();
			// @ts-ignore
			return client[prop];
		},
		apply(_, thisArg, args) {
			const client = ensureClient();
			// @ts-ignore
			return (client as any).apply(thisArg, args);
		},
	}
);