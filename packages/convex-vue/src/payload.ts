import { stringify, parse } from 'devalue';
import { isServer } from './utils';

export interface ConvexSSRPayload {
  [key: string]: any;
}

declare global {
  interface Window {
    __CONVEX_PAYLOAD__?: string;
  }

  var __CONVEX_SSR_PAYLOAD__: ConvexSSRPayload | undefined;
}

class PayloadManager {
  private serverPayload: ConvexSSRPayload = {};

  /**
   * Creates a unique key for storing query data in the payload
   */
  createPayloadKey(queryName: string, args: any): string {
    return `${queryName}_${JSON.stringify(args)}`;
  }

  /**
   * Stores data in the server-side payload during SSR
   */
  setServerData(key: string, data: any): void {
    if (isServer) {
      this.serverPayload[key] = data;
      // Also store in globalThis for serialization
      globalThis.__CONVEX_SSR_PAYLOAD__ = globalThis.__CONVEX_SSR_PAYLOAD__ || {};
      globalThis.__CONVEX_SSR_PAYLOAD__[key] = data;
    }
  }

  /**
   * Retrieves data from the client-side payload during hydration
   */
  getClientData(key: string): any {
    if (!isServer && typeof window !== 'undefined') {
      const payload = window.__CONVEX_PAYLOAD__;
      if (payload) {
        return parse(payload)?.[key];
      }
    }
    return undefined;
  }

  /**
   * Serializes the server payload to be injected into HTML
   */
  serializePayload(): string {
    if (isServer) {
      const payload = globalThis.__CONVEX_SSR_PAYLOAD__ || {};
      try {
        return stringify(payload);
      } catch (error) {
        console.warn('Failed to serialize Convex SSR payload:', error);
        return '{}';
      }
    }
    return '{}';
  }

  /**
   * Resets the payload (useful for testing or manual cleanup)
   */
  reset(): void {
    this.serverPayload = {};
    if (isServer) {
      globalThis.__CONVEX_SSR_PAYLOAD__ = {};
    } else if (typeof window !== 'undefined') {
      window.__CONVEX_PAYLOAD__ = '';
    }
  }
}

// Singleton instance
export const payloadManager = new PayloadManager();

/**
 * Utility function to serialize just the payload data (without script wrapper)
 * Useful if you want to handle script injection yourself
 */
export function getSerializedPayload(): string {
  return payloadManager.serializePayload();
}
