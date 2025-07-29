# Convex Vue

Vue.js integration for [Convex](https://convex.dev) - the fullstack TypeScript development platform.

## Features

- 🚀 **SSR Support** - Full server-side rendering compatibility
- 🔐 **Authentication** - Built-in auth support for server-side requests
- ⚡ **Reactive Queries** - Vue-native composables with reactive data binding
- 🔄 **Real-time Updates** - Automatic UI updates when data changes
- 📦 **TypeScript** - Full type safety with Convex schema inference

## Quick Start

```bash
# ✨ Auto-detect
npx nypm install @adinvadin/convex-vue

# npm
npm install @adinvadin/convex-vue

# yarn
yarn add @adinvadin/convex-vue

# pnpm
pnpm install @adinvadin/convex-vue
```

```typescript
// main.ts
import { createApp } from 'vue';
import { createConvexVue } from '@adinvadin/convex-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
  createConvexVue({
    convexUrl: process.env.VITE_CONVEX_URL!
  })
);

app.mount('#app');
```

```vue
<!-- Component.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import {
  useConvexQuery,
  useConvexMutation,
  useConvexAction
} from '@adinvadin/convex-vue';
import { api } from './convex/_generated/api';

// Query
const { data: messages, isLoading } = useConvexQuery(api.messages.getMessages, {});

// Mutation
const { mutate: sendMessage, isLoading: isSending } = useConvexMutation(
  api.messages.send
);

// Action
const { mutate: generateSummary, isLoading: isGenerating } = useConvexAction(
  api.messages.generateSummary
);

const newMessage = ref('');

async function handleSend() {
  if (newMessage.value.trim()) {
    await sendMessage({ text: newMessage.value });
    newMessage.value = '';
  }
}

async function handleGenerateSummary() {
  await generateSummary({});
}
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else>
    <div v-for="message in messages" :key="message._id">
      {{ message.text }}
    </div>

    <form @submit.prevent="handleSend">
      <input v-model="newMessage" placeholder="Type a message..." />
      <button type="submit" :disabled="isSending">
        {{ isSending ? 'Sending...' : 'Send' }}
      </button>
    </form>

    <button @click="handleGenerateSummary" :disabled="isGenerating">
      {{ isGenerating ? 'Generating...' : 'Generate Summary' }}
    </button>
  </div>
</template>
```

## Nuxt Integration

For Nuxt applications, create a plugin to integrate Convex with Clerk authentication:

```typescript
// plugins/convex.ts
import { createConvexVue } from '@adinvadin/convex-vue';

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig();

  if (!config.public.convexUrl) {
    console.error('Convex URL is not configured. Please add it to your nuxt.config.ts');
    throw new Error('Missing Convex URL configuration');
  }

  const { userId, isLoaded, getToken } = useAuth();

  const event = useRequestEvent();
  const convex = createConvexVue({
    convexUrl: config.public.convexUrl,
    auth: {
      isAuthenticated: computed(() => !!userId.value),
      isLoading: computed(() => !isLoaded.value),
      getToken: async opts => {
        try {
          if (import.meta.server && event) {
            return await event.context.auth().getToken({
              template: 'convex'
            });
          }

          return await getToken.value({
            template: 'convex',
            skipCache: opts.forceRefreshToken
          });
        } catch (error) {
          return null;
        }
      }
    }
  });

  nuxtApp.vueApp.use(convex);
});
```

## API Reference

### Composables

#### `useConvex`

Returns the [`ConvexClient`](https://docs.convex.dev/api/classes/browser.ConvexClient) instance for one-off queries and custom functionality.

```typescript
import { useConvex } from '@adinvadin/convex-vue';

const convex = useConvex();
const data = await convex.query(api.todos.list, {});
```

#### `useConvexQuery`

Subscribes to a [Convex Query](https://docs.convex.dev/functions/query-functions) with reactive data binding and SSR support.

```typescript
const { data, isLoading, error, suspense } = useConvexQuery(
  api.todos.list,
  { completed: true }, // reactive arguments
  { enabled: true } // options
);

await suspense(); // for <Suspense /> boundary
```

#### `useConvexPaginatedQuery`

Subscribes to a [Convex Paginated Query](https://docs.convex.dev/database/pagination).

```typescript
const {
  data,
  lastPage,
  isLoading,
  isLoadingMore,
  isDone,
  loadMore,
  reset,
  pages,
  error,
  suspense
} = useConvexPaginatedQuery(api.todos.list, { completed: true }, { numItems: 50 });
```

#### `useConvexMutation`

Handles [Convex Mutations](https://docs.convex.dev/functions/mutation-functions) with optimistic updates support.

```typescript
const {
  isLoading,
  error,
  mutate: addTodo
} = useConvexMutation(api.todos.add, {
  onSuccess() {
    todo.value = '';
  },
  onError(err) {
    console.error(err);
  },
  optimisticUpdate(ctx) {
    const current = ctx.getQuery(api.todos.list, {});
    if (!current) return;

    ctx.setQuery(api.todos.list, {}, [
      {
        _creationTime: Date.now(),
        _id: 'optimistic_id' as Id<'todos'>,
        completed: false,
        text: todo.text
      },
      ...current
    ]);
  }
});
```

#### `useConvexAction`

Handles [Convex Actions](https://docs.convex.dev/functions/actions).

```typescript
const { isLoading, error, mutate } = useConvexAction(api.some.action, {
  onSuccess(result) {
    console.log(result);
  },
  onError(err) {
    console.error(err);
  }
});
```

### Components

#### `<ConvexQuery />`

Template component for queries with loading, error, and empty states.

```vue
<ConvexQuery :query="api.todos.list" :args="{}">
  <template #loading>Loading todos...</template>
  <template #error="{ error }">{{ error }}</template>
  <template #empty>No todos yet.</template>
  <template #default="{ data: todos }">
    <ul>
      <li v-for="todo in todos" :key="todo._id">
        <Todo :todo="todo" />
      </li>
    </ul>
  </template>
</ConvexQuery>
```

#### `<ConvexPaginatedQuery />`

Template component for paginated queries.

```vue
<ConvexPaginatedQuery
  :query="api.todos.paginatedList"
  :args="{}"
  :options="{ numItems: 5 }"
>
  <template #loading>Loading todos...</template>
  <template #error="{ error, reset }">
    <p>{{ error }}</p>
    <button @click="reset">Retry</button>
  </template>
  <template #default="{ data: todos, isDone, loadMore, isLoadingMore, reset }">
    <ul>
      <li v-for="todo in todos" :key="todo._id">
        <Todo :todo="todo" />
      </li>
    </ul>
    <Spinner v-if="isLoadingMore" />
    <footer>
      <button :disabled="isDone" @click="loadMore">Load more</button>
      <button @click="reset">Reset</button>
    </footer>
  </template>
</ConvexPaginatedQuery>
```

## Authentication Examples

### Clerk

```typescript
import { createConvexVue } from '@adinvadin/convex-vue';
import { clerkPlugin } from 'vue-clerk/plugin';

const app = createApp(App).use(clerkPlugin, {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
});

const authState = {
  isLoading: ref(true),
  session: ref(undefined)
};

app.config.globalProperties.$clerk.addListener(arg => {
  authState.isLoading.value = false;
  authState.session.value = arg.session;
});

const convexVue = createConvexVue({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  auth: {
    isAuthenticated: computed(() => !!authState.session.value),
    isLoading: authState.isLoading,
    getToken: async ({ forceRefreshToken }) => {
      try {
        return await authState.session.value?.getToken({
          template: 'convex',
          skipCache: forceRefreshToken
        });
      } catch (error) {
        return null;
      }
    }
  }
});

app.use(convexVue);
```

### Auth0

```typescript
import { createConvexVue } from '@adinvadin/convex-vue';
import { createAuth0 } from '@auth0/auth0-vue';

const auth = createAuth0({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENTID,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});

const convexVue = createConvexVue({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  auth: {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    getToken: async ({ forceRefreshToken }) => {
      try {
        const response = await auth.getAccessTokenSilently({
          detailedResponse: true,
          cacheMode: forceRefreshToken ? 'off' : 'on'
        });
        return response.id_token;
      } catch (error) {
        return null;
      }
    },
    installNavigationGuard: true,
    needsAuth: to => to.meta.needsAuth,
    redirectTo: () => ({ name: 'Login' })
  }
});

app.use(convexVue);
```

## Packages

- `@adinvadin/convex-vue` - Core Vue.js integration with composables and plugin
