import { CoreMigrations } from '../src/core/migrations.mjs';

if (typeof globalThis !== 'undefined') globalThis.CoreMigrations = CoreMigrations;
