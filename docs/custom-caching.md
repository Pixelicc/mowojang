# 💾 Custom Caching / Storage

As the `Mowojang` library just uses the `axios-cache-interceptor` library internally you can also follow their docs on the two exported builders accessable via the cache export: `buildMemoryStorage()` and `buildStorage()`.

Docs: https://axios-cache-interceptor.js.org/guide/storages

## Custom Memory Storage

```TS
import { Client, cache } from "mowojang"

const Mowojang = new Client({
  cache: {
    storage: cache.buildMemoryStorage(
      false, // Doesn't clone data
      60 * 60 * 1000, // Cleans outdated cache entries every hour
      false // Doesn't set a max entry limit
      60 * 60 * 1000 // Cleans stale cache entries every hour
      /**
       * More detailed documentation:
       *
       * https://axios-cache-interceptor.js.org/guide/storages#memory-storage
       */
    )
  }
})
```

## Custom Storage

```TS
import { Client, cache } from "mowojang"

const Mowojang = new Client({
  cache: {
    storage: cache.buildStorage({
      /**
       * More detailed documentation:
       *
       * https://axios-cache-interceptor.js.org/guide/storages#buildstorage
       */
    })
  }
})
```
