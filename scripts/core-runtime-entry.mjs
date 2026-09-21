import { CoreRuntime } from '../src/core/runtime.mjs';

if (typeof globalThis !== 'undefined') globalThis.CoreRuntime = CoreRuntime;
