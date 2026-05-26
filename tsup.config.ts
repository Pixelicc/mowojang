import { defineConfig } from "tsup";
import packageJson from "./package.json";

/**
 * Bundeling is currently needed as npm does not natively allow you to install jsr dependencies.
 * The .npmrc file also isnt possible to publish so for now this will bundle them into the code directly.
 */

const dependencies = Object.keys(packageJson.dependencies || {});
const jsrDependencies = dependencies.filter((dep) => {
  // @ts-expect-error
  const version = packageJson.dependencies[dep];
  return version.startsWith("npm:@jsr/") || version.startsWith("jsr:");
});
const npmDependencies = dependencies.filter((dep) => !jsrDependencies.includes(dep));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  keepNames: true,
  noExternal: jsrDependencies,
  external: npmDependencies,
});
