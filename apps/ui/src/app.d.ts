// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // Using a type alias avoids lint complaints about empty interfaces while keeping compatibility with SvelteKit types.
    type PageData = Record<string, unknown>;
    interface Locals {
      requestId: string;
    }
  }

  interface ImportMetaEnv {
    readonly VITE_API_BASE: string;
    readonly VITE_USE_MOCKS?: string;
    readonly VITE_FEATURE_VIDEO?: string;
    readonly VITE_FEATURE_ZIGBEE?: string;
    readonly VITE_FEATURE_CAMERA?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
