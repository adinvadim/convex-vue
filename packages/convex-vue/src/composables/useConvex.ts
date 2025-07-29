import { CONVEX_HTTP_CLIENT_INJECTION_KEY, CONVEX_INJECTION_KEY } from '@/plugin';
import { useSafeInject } from '@/utils';

export const useConvex = () => {
  return useSafeInject(CONVEX_INJECTION_KEY);
};

export const useConvexHttpClient = () => {
  return useSafeInject(CONVEX_HTTP_CLIENT_INJECTION_KEY);
};
