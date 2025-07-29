import { inject, type Ref, watch } from 'vue';
import { CONVEX_AUTH_INJECTION_KEY } from '@/plugin';
import { Nullable } from '@/types';
import { isServer } from '@/utils';

export function useConvexAuth() {
  const authState = inject(CONVEX_AUTH_INJECTION_KEY, null);

  if (!authState) {
    throw new Error('useConvexAuth must be used within a ConvexVue plugin');
  }

  return {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    getToken: authState.getToken,
    setServerToken: authState.setServerToken,

    /**
     * Ensures that the server token is set for server-side rendering.
     * Waits for authentication loading to complete and sets the token if authenticated.
     * @returns Promise<string | null> - The authentication token or null if not authenticated
     */
    async ensureServerToken() {
      if (!isServer) return;

      if (authState.isLoading.value) {
        await new Promise<void>(resolve => {
          const unwatch = watch(
            authState.isLoading,
            loading => {
              if (!loading) {
                unwatch();
                resolve();
              }
            },
            { immediate: true }
          );
        });
      }

      if (authState.isAuthenticated.value) {
        const token = await authState.getToken({ forceRefreshToken: false });
        if (token && authState.setServerToken) {
          authState.setServerToken(token);
          return token;
        }
      }

      return null;
    }
  };
}
