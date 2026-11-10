/// <reference types="vite/client" />

/** Injected at build time: "X.Y.Z+<sha7>" for what main deploys, "X.Y.Z-dev..." otherwise. */
declare const __BUILD_LABEL__: string;

/** package.json version, injected at build time. */
declare const __VERSION__: string;
