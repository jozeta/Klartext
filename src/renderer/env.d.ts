import type { KlartextBridgeAPI } from '../preload'

declare global {
  interface Window {
    klartext: KlartextBridgeAPI
  }
}
export {}
