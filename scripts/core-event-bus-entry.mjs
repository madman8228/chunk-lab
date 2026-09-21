import { CoreEventBus } from '../src/core/event-bus.mjs';

if (typeof globalThis !== 'undefined') globalThis.CoreEventBus = CoreEventBus;
