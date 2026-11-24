/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_PARTII_API?: string;
  readonly VITE_PARTII_KEY?: string;
  readonly VITE_PARTII_GAME?: string;
  readonly VITE_GAME_VERSION?: string;
  /** The Motionii runtime folder (default: Partii staging's 0.1.0). The bench build points it at its own copy. */
  readonly VITE_MOTIONII_BASE?: string;
}
