import { defineConfig } from "tsup";
import packageJSON from "./package.json";

/**
 * Bundeling is currently needed as npm does not natively allow you to install jsr dependencies.
 * The .npmrc file also isnt possible to publish so for now this will bundle them into the code directly.
 */

const dependencies = Object.keys(packageJSON.dependencies || {});
const jsrDependencies = dependencies.filter((dep) => {
  // @ts-expect-error
  const version = packageJSON.dependencies[dep];
  return version.startsWith("jsr:");
});
const npmDependencies = dependencies.filter((dep) => !jsrDependencies.includes(dep));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  keepNames: true,
  treeshake: true,
  define: {
    VERSION: JSON.stringify([packageJSON.version]),
  },
  noExternal: jsrDependencies,
  external: npmDependencies,
});
