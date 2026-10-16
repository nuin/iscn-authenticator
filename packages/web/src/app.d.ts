import type { Session, User } from '#lib/server/db.js';

declare global {
	namespace App {
		interface Locals {
			session: Session | null;
			user: User | null;
		}
	}
}

export {};
