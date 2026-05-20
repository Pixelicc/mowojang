# mowojang-js

![NPM Version](https://img.shields.io/npm/v/mowojang?label=NPM)
![NPM Downloads](https://img.shields.io/npm/dm/mowojang?label=Downloads)
![NPM License](https://img.shields.io/npm/l/mowojang?label=License)

> [!IMPORTANT]
> This is a third party wrapper for the [Mowojang-API](https://mowojang.matdoes.dev/)!

## ✨ Quick Start

```TS
import { Client as MowojangClient } from "mowojang"

const Mowojang = new MowojangClient()

const UUID = await Mowojang.getUUID("Pixelic")
const username = await Mowojang.getUsername("14727fae-fbdc-4aff-848c-d2713eb9939e")
```

> [!TIP]
> If you plan on using this in a long-running process with heavy usage check out this guide on how to setup custom caching to prevent memory leaks.
> Guide: [Custom-Caching](docs/custom-caching.md)

## 🔧 Functions / Supported Endpoints

- `getProfiles()`: Retrieve full Player Data of multiple Players by UUID or Username
- `getProfile()`: Retrieve full Player Data by UUID or Username
- `getSessions()`: Retrieve Player Session Data of multiple Players by UUID or Username
- `getSession()`: Retrieve Player Session Data by UUID or Username
- `getUUID()`: Converts a Player's Username to UUID
- `getUsername()`: Converts a Player's UUID to Username
- `getSkin()`: Returns the Skin the specified Player is currently wearing
- `getSkinBuffer()`: Returns Skin Image fetched via getSkin() as a Buffer
- `getCape()`: Returns the Cape the specified Player has currently selected
- `getCapeBuffer()`: Returns Cape Image fetched via getCape() as a Buffer

All above Functions accept an second Argument containing an optional config object.
Cache options can also be passed there via the cache key. All available cache options can be found [here](https://axios-cache-interceptor.js.org/config/request-specifics#cache).

Note: `getProfiles()` defaults to fetching each profile via individual GET requests to improve reliability. To use the POST bulk endpoint instead, pass `{ usePost: true }` as the second argument to `getProfiles()`.

## 🗃️ Utility Functions

All Utility Functions are exported combined as `utlis.x`.

- `dashUUID()`: Adds dashes to UUIDv4 (If the UUIDv4 is already dashed nothing will change)
- `undashUUID()`: Removes all dashes from UUIDv4

## 🗂️ Validator Functions

All Validator Functions are exported combined as `validate.x`.

- `UUID()`: Returns whether the provided String is an valid UUID (Accepts both undashed and dashed UUIDv4 Strings)
- `username()`: Returns whether the provided String is an valid Username (Accepts a second argument stating the minimum length required to pass the validation)
- `player()` Combines the above

## ⚙️ Development

- `pnpm install`: Installs all required dependencies
- `pnpm build`: Runs the TypeScript compiler
- `pnpm test`: Runs tests for all Functions

## 📎 Credits

- Mowojang Creator (Mat):
  - [Website](https://matdoes.dev)
  - [GitHub](https://github.com/mat-1)
  - [Ko-Fi](https://ko-fi.com/matdoesdev)
