/** Short commit hash of the build (vite.config.ts), "dev" locally. */
declare const __APP_COMMIT__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
