import {
  FunctionReference,
  PaginationOptions,
  PaginationResult,
  FunctionArgs,
  getFunctionName
} from 'convex/server';
import { MaybeRefOrGetter, ref, computed, toValue, watch, nextTick } from 'vue';
import { Prettify, DistributiveOmit } from '@/types';
import { useConvexQuery } from './useQuery';
import { useConvex } from './useConvex';
import { isServer } from '@/utils';

export type PaginatedQueryReference<T> = FunctionReference<
  'query',
  'public',
  { paginationOpts: PaginationOptions },
  PaginationResult<T>
>;

export type PaginatedQueryArgs<T, Query extends PaginatedQueryReference<T>> = Prettify<
  DistributiveOmit<FunctionArgs<Query>, 'paginationOpts'>
>;

const isRecoverableError = (err: Error) => {
  return (
    err.message.includes('InvalidCursor') ||
    err.message.includes('ArrayTooLong') ||
    err.message.includes('TooManyReads') ||
    err.message.includes('TooManyDocumentsRead') ||
    err.message.includes('ReadsTooLarge')
  );
};

export type UseConvexPaginatedQueryOptions = { numItems: number };

export const useConvexPaginatedQuery = <T>(
  query: PaginatedQueryReference<T>,
  args: MaybeRefOrGetter<PaginatedQueryArgs<T, PaginatedQueryReference<T>>>,
  options: { numItems: number }
) => {
  type PageType = any;

  const pages = ref<PageType[]>([]);
  const isDone = ref(false);
  const isLoadingMore = ref(false);
  const currentPageIndex = ref(0);

  const firstPageArgs = computed(() => ({
    ...toValue(args),
    paginationOpts: {
      numItems: options.numItems,
      cursor: null
    }
  }));

  const {
    data: firstPageData,
    error: firstPageError,
    isLoading: isFirstPageLoading
  } = useConvexQuery(query, firstPageArgs, { enabled: true });

  watch(
    firstPageData,
    newData => {
      if (newData) {
        pages.value[0] = newData as PageType;
        isDone.value = newData.isDone;
      }
    },
    { immediate: true }
  );

  if (isServer) {
    return {
      suspense: () => Promise.resolve(firstPageData.value?.page || []),
      pages: computed(() => pages.value.map(p => p.page)),
      data: computed(() => pages.value.filter(p => !!p).flatMap(p => p.page)),
      lastPage: computed(() => pages.value.at(-1)),
      error: firstPageError,
      isDone,
      isLoading: isFirstPageLoading,
      isLoadingMore: ref(false),
      loadMore: () => Promise.resolve(),
      reset: () => {
        pages.value = [];
        isDone.value = false;
        currentPageIndex.value = 0;
      }
    } as any;
  }

  const client = useConvex();
  const subscribers = ref<(() => void)[]>([]);

  let resolve: (data: PageType['page'][]) => void;
  let reject: (err: Error) => void;
  const suspensePromise = new Promise<PageType['page'][]>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const reset = (refetch: Boolean) => {
    subscribers.value.forEach(unsub => unsub());
    subscribers.value = [];
    pages.value = [];
    currentPageIndex.value = 0;
    if (refetch) {
      nextTick(() => {
        loadPage(0);
      });
    }
  };

  const loadPage = (index: number) => {
    subscribers.value[index]?.();
    if (pages.value.length) {
      isLoadingMore.value = true;
    }
    subscribers.value[index] = client.onUpdate(
      query,
      {
        ...toValue(args),
        paginationOpts: {
          numItems: options.numItems,
          cursor: pages.value[index - 1]?.continueCursor ?? null
        }
      },
      newPage => {
        pages.value[index] = newPage as PageType;
        resolve?.(pages.value.map(p => p.page) as any);
        isDone.value = newPage.isDone;
        isLoadingMore.value = false;
      },
      err => {
        isLoadingMore.value = false;
        reject?.(err);
        if (isRecoverableError(err)) {
          reset(false);
        }
      }
    );
  };

  const queryName = computed(() => getFunctionName(query));
  const unwrappedArgs = computed(() => toValue(args));

  watch(queryName, () => reset(true));
  watch(unwrappedArgs, (newArgs, oldArgs) => {
    const hasChanged = JSON.stringify(newArgs) !== JSON.stringify(oldArgs);
    if (hasChanged) reset(true);
  });

  loadPage(0);

  return {
    suspense: () => suspensePromise,
    pages: computed(() => pages.value.map(p => p.page)),
    data: computed(() => pages.value.filter(p => !!p).flatMap(p => p.page)),
    lastPage: computed(() => pages.value.at(-1)),
    error: firstPageError,
    isDone,
    isLoading: computed(() => !pages.value.length),
    isLoadingMore,
    loadMore: () => loadPage(pages.value.length),
    reset: () => reset(true)
  } as any;
};
