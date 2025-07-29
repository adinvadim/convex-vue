import {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
  getFunctionName
} from 'convex/server';
import {
  type MaybeRef,
  type MaybeRefOrGetter,
  ref,
  computed,
  unref,
  toValue,
  watch,
  type Ref,
  type UnwrapRef,
  type ComputedRef,
  onServerPrefetch
} from 'vue';
import { Nullable } from '@/types';
import { useConvex, useConvexHttpClient } from './useConvex';
import { isServer } from '@/utils';
import { useConvexAuth } from './useConvexAuth';

export type UseConvexQueryOptions = {
  enabled?: MaybeRef<boolean>;
};

export type QueryReference = FunctionReference<'query'>;

function _useServerQuery<Query extends QueryReference>(
  query: Query,
  args: MaybeRefOrGetter<FunctionArgs<Query>>,
  options: UseConvexQueryOptions = { enabled: true }
): {
  suspense: () => Promise<FunctionReturnType<Query>>;
  data: Ref<UnwrapRef<FunctionReturnType<Query>>>;
  error: Ref<Nullable<Error>>;
  isLoading: ComputedRef<boolean>;
} {
  const data = ref<FunctionReturnType<Query>>(undefined);
  const error = ref<Error | null>(null);
  const isEnabled = computed(() => unref(options.enabled) ?? true);
  const isLoading = computed(() => data.value === undefined && error.value === null);

  const httpClient = useConvexHttpClient();

  const authState = useConvexAuth();

  const executeQuery = async () => {
    if (!isEnabled.value) {
      return undefined;
    }

    try {
      if (isServer) {
        await authState.ensureServerToken();
      }

      const result = await httpClient.query(query, toValue(args));
      data.value = result;
      error.value = null;
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      error.value = errorObj;
      data.value = undefined;
      throw errorObj;
    }
  };

  const promise = executeQuery();

  onServerPrefetch(async () => {
    try {
      await promise;
    } catch (err) {
      console.warn('Server query failed:', err);
    }
  });

  return {
    data,
    error,
    isLoading,
    suspense: () => promise
  };
}

/**
 * Composable for executing Convex queries with reactive data binding.
 * Automatically handles server-side rendering and client-side updates.
 * SSR-friendly with automatic hydration support.
 *
 * @template Query - The Convex query function reference
 * @param query - The Convex query function to execute
 * @param args - The arguments to pass to the query (can be reactive)
 * @param options - Configuration options for the query
 * @param options.enabled - Whether the query should be enabled (default: true). Similar to React Query's "skip" behavior
 * @returns Object containing:
 *   - suspense: Function that returns a promise resolving to query result
 *   - data: Reactive ref containing the query result data
 *   - error: Reactive ref containing any error that occurred (null if no error)
 *   - isLoading: Computed ref indicating if the query is currently loading
 */
export const useConvexQuery: <Query extends QueryReference>(
  query: Query,
  args: MaybeRefOrGetter<FunctionArgs<Query>>,
  options?: UseConvexQueryOptions
) => {
  suspense: () => Promise<FunctionReturnType<Query>>;
  data: Ref<FunctionReturnType<Query>>;
  error: Ref<Nullable<Error>>;
  isLoading: ComputedRef<boolean>;
} = <Query extends QueryReference>(
  query: Query,
  args: MaybeRefOrGetter<FunctionArgs<Query>>,
  options: UseConvexQueryOptions = { enabled: true }
) => {
  if (isServer) {
    return _useServerQuery(query, args, options);
  }

  const client = useConvex();

  const data = ref<FunctionReturnType<Query>>(
    client.client.localQueryResult(getFunctionName(query), toValue(args))
  );
  const error = ref<Nullable<Error>>(null);

  let unsub: () => void;
  const isEnabled = computed(() => unref(options.enabled) ?? true);

  let resolve: (data: FunctionReturnType<Query>) => void;
  let reject: (err: Error) => void;
  const suspensePromise = new Promise<FunctionReturnType<Query>>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const bind = () => {
    unsub?.();
    if (isEnabled.value) {
      unsub = client.onUpdate(
        query,
        toValue(args),
        newData => {
          data.value = newData;
          resolve?.(newData);
          error.value = null;
        },
        err => {
          data.value = null;
          reject(err);
          error.value = err;
        }
      );
    }
  };

  watch(isEnabled, bind, { immediate: true });
  watch(() => toValue(args), bind, { deep: true });

  return {
    suspense: () => suspensePromise,
    data,
    error,
    isLoading: computed(() => data.value === undefined && error.value === null)
  };
};
