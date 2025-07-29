import { isServer } from './utils';
import { isRef } from 'vue';

export interface ConvexSSRPayload {
  [key: string]: any;
}

declare global {
  interface Window {
    __CONVEX_PAYLOAD__?: string;
  }
}

class PayloadManager {
  private ssrConfig: any = null;

  /**
   * Initialize the payload manager with SSR configuration
   * Called from composables that have access to inject()
   */
  init(ssrConfig: any) {
    this.ssrConfig = ssrConfig;
  }

  /**
   * Creates a unique key for storing query data in the payload
   */
  createPayloadKey(queryName: string, args: any): string {
    return `${queryName}_${JSON.stringify(args)}`;
  }

  /**
   * Gets the current request-scoped payload storage using SSR config
   * Delegates to user-provided implementation for request isolation
   */
  private getCurrentPayload() {
    if (this.ssrConfig) {
      const storage = this.ssrConfig.payloadStorage();
      return isRef(storage) ? storage.value : storage;
    }

    console.warn(
      '[ConvexVue] No SSR config provided, fallback empty object as payload storage'
    );
    return {};
  }

  /**
   * Stores data in the server-side payload during SSR
   * Uses user-provided storage implementation for request isolation
   */
  setServerData(key: string, data: any): void {
    if (isServer) {
      const payload = this.getCurrentPayload();
      payload[key] = data;
    }
  }

  /**
   * Retrieves data from the client-side payload during hydration
   */
  getClientData(key: string): any {
    const payload = this.getCurrentPayload();
    return payload[key];
  }
}

// Singleton instance
export const payloadManager = new PayloadManager();
