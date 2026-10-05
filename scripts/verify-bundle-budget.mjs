import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const CLIENT_DIRECTORY = 'client';
const ASSET_EXTENSIONS = new Set(['.js', '.mjs']);
const DEFAULT_ENTRY_NAME = 'InfrastructureWorkbench.tsx';
const REGISTRY_ENTRY_STEM = 'ContentSchemaRegistryWorkbenchIsland';

export const BUNDLE_BUDGETS = Object.freeze({
  workbenchGzipBytes: 35 * 1024,
  initialRouteGzipBytes: 90 * 1024,
  lazyChunkGzipBytes: 80 * 1024,
});

const resolveSourceRevision = () => {
  const configuredRevision =
    process.env.SOURCE_REVISION ?? process.env.GITHUB_SHA;
  const sourceRevision =
    configuredRevision ??
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: resolve('.'),
      encoding: 'utf8',
    }).trim();
  if (!/^[a-f0-9]{40}$/.test(sourceRevision))
    throw new Error('SOURCE_REVISION must be a full lowercase commit SHA');
  return sourceRevision;
};

/**
 * @typedef {{ path: string, rawBytes: number, gzipBytes: number }} BundleAsset
 * @typedef {{
 *   budgets: typeof BUNDLE_BUDGETS,
 *   workbench: BundleAsset,
 *   workbenchAssets: string[],
 *   workbenchGzipBytes: number,
 *   initialAssets: string[],
 *   initialRouteGzipBytes: number,
 *   lazyAssets: string[],
 *   lazyChunks: BundleAsset[],
 *   lazyChunkGzipBytes: number[],
 *   allClientGzipBytes: number,
 *   manifestPath: string|null,
 *   workbenchLabel: string,
 *   routeLabel: string,
 * }} BundleBudgetReport
 */

/**
 * Return every browser JavaScript asset in a build, in stable path order.
 *
 * @param {string} clientDirectory
 * @returns {string[]}
 */
function findClientAssets(clientDirectory) {
  /** @type {string[]} */
  const assets = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (ASSET_EXTENSIONS.has(extname(entry.name))) {
        assets.push(path);
      }
    }
  };
  visit(clientDirectory);
  return assets.sort();
}

/**
 * Read the first Vite manifest emitted by an Astro build. The fallback is
 * intentional: Astro's Cloudflare adapter does not emit a manifest unless
 * Vite manifest output is enabled, so the hashed island/runtime names remain
 * discoverable from the browser build itself.
 *
 * @param {string} distDirectory
 * @param {string|undefined} manifestPath
 * @returns {{ path: string, entries: Record<string, ManifestEntry> }|null}
 */
function readManifest(distDirectory, manifestPath) {
  const candidates = manifestPath
    ? [resolve(distDirectory, manifestPath)]
    : [
        resolve(distDirectory, 'client/.vite/manifest.json'),
        resolve(distDirectory, 'client/.vite-manifest.json'),
        resolve(distDirectory, '.vite/manifest.json'),
        resolve(distDirectory, 'client/manifest.json'),
      ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          path: relative(distDirectory, candidate),
          entries: /** @type {Record<string, ManifestEntry>} */ (parsed),
        };
      }
    } catch {
      // A missing or malformed optional manifest uses the build-output path.
    }
  }
  return null;
}

/**
 * @typedef {{ file?: string, imports?: string[], dynamicImports?: string[], isEntry?: boolean }} ManifestEntry
 */

/**
 * Resolve a Vite manifest asset to a path relative to the build directory.
 * Manifest files normally use `client/_astro/...`; fixture and older Astro
 * manifests may use `_astro/...` relative to `client/`.
 *
 * @param {string} distDirectory
 * @param {string} manifestPath
 * @param {string} asset
 * @returns {string}
 */
function resolveManifestAsset(distDirectory, manifestPath, asset) {
  const normalized = asset.replaceAll('\\', '/').replace(/^\/+/, '');
  const candidates = [
    resolve(distDirectory, normalized),
    resolve(distDirectory, dirname(manifestPath), normalized),
    resolve(distDirectory, CLIENT_DIRECTORY, normalized),
  ];
  const selected = candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  return relative(distDirectory, selected ?? candidates[0]);
}

/**
 * @param {Record<string, ManifestEntry>} entries
 * @param {string} entryName
 * @param {Set<string>} assets
 * @param {Set<string>} visited
 * @param {string} distDirectory
 * @param {string} manifestPath
 * @returns {void}
 */
function collectStaticManifestAssets(
  entries,
  entryName,
  assets,
  visited,
  distDirectory,
  manifestPath,
) {
  if (visited.has(entryName)) return;
  visited.add(entryName);
  const entry = entries[entryName];
  if (!entry) return;
  if (entry.file) {
    assets.add(resolveManifestAsset(distDirectory, manifestPath, entry.file));
  }
  for (const importedName of entry.imports ?? []) {
    const importedEntry = entries[importedName];
    if (importedEntry) {
      collectStaticManifestAssets(
        entries,
        importedName,
        assets,
        visited,
        distDirectory,
        manifestPath,
      );
    } else {
      assets.add(
        resolveManifestAsset(distDirectory, manifestPath, importedName),
      );
    }
  }
}

/**
 * @param {Record<string, ManifestEntry>} entries
 * @param {string} entryName
 * @param {Set<string>} assets
 * @param {Set<string>} visited
 * @param {string} distDirectory
 * @param {string} manifestPath
 * @returns {void}
 */
function collectDynamicManifestAssets(
  entries,
  entryName,
  assets,
  visited,
  distDirectory,
  manifestPath,
) {
  if (visited.has(entryName)) return;
  visited.add(entryName);
  const entry = entries[entryName];
  if (!entry) return;
  for (const dynamicName of entry.dynamicImports ?? []) {
    const dynamicEntry = entries[dynamicName];
    if (dynamicEntry) {
      if (dynamicEntry.file) {
        assets.add(
          resolveManifestAsset(distDirectory, manifestPath, dynamicEntry.file),
        );
      }
      collectStaticManifestAssets(
        entries,
        dynamicName,
        assets,
        new Set(),
        distDirectory,
        manifestPath,
      );
      collectDynamicManifestAssets(
        entries,
        dynamicName,
        assets,
        visited,
        distDirectory,
        manifestPath,
      );
    } else {
      assets.add(
        resolveManifestAsset(distDirectory, manifestPath, dynamicName),
      );
    }
  }
}

/**
 * @param {string[]} clientAssets
 * @param {string} entryStem
 * @returns {string|undefined}
 */
function findBrowserEntry(clientAssets, entryStem) {
  const escapedStem = entryStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedStem}\\.[^/]+\\.(?:js|mjs)$`);
  return clientAssets.find((path) => pattern.test(basename(path)));
}

/**
 * @param {string[]} clientAssets
 * @returns {string[]}
 */
function findAstroRuntimeAssets(clientAssets) {
  return clientAssets.filter((path) =>
    /^(?:client|react)\.[^/]+\.(?:js|mjs)$/.test(basename(path)),
  );
}

/**
 * The representative infrastructure detail route owns the same Workbench
 * hydration contract as the index route, but has an unambiguous emitted name.
 * Its static closure includes the route-heading focus script.
 *
 * @param {string[]} clientAssets
 * @returns {string[]}
 */
function findInfrastructureRouteAssets(clientAssets) {
  return clientAssets.filter((path) =>
    /^_recordId_\.astro_astro_type_script_index_0_lang\.[^/]+\.(?:js|mjs)$/.test(
      basename(path),
    ),
  );
}

/**
 * @param {string[]} clientAssets
 * @param {string} entryStem
 * @returns {string[]}
 */
function findRouteAssets(clientAssets, entryStem) {
  if (entryStem === 'InfrastructureWorkbench') {
    return findInfrastructureRouteAssets(clientAssets);
  }
  if (entryStem === 'SettingsFlagsRuntimeWorkbench') {
    return clientAssets.filter((path) =>
      /^PlatformConfigurationAdminRoute\.astro_astro_type_script_index_0_lang\.[^/]+\.(?:js|mjs)$/.test(
        basename(path),
      ),
    );
  }
  if (entryStem === REGISTRY_ENTRY_STEM) {
    // The registry route loads the shared route-heading focus script beside
    // its island; the island's static closure does not include it.
    return clientAssets.filter((path) =>
      /^route-heading-focus\.[^/]+\.(?:js|mjs)$/.test(basename(path)),
    );
  }
  return [];
}

/**
 * @param {string} source
 * @param {number} start
 * @returns {number}
 */
function skipJavaScriptIgnorables(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/u.test(source[index])) {
      index += 1;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '/') {
      const lineEnd = source.indexOf('\n', index + 2);
      index = lineEnd === -1 ? source.length : lineEnd + 1;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }
    break;
  }
  return index;
}

/**
 * Read a quoted JavaScript literal while preserving the module specifier and
 * skipping escaped delimiters. Template literals with interpolation are
 * rejected because they do not identify a deterministic build asset.
 *
 * @param {string} source
 * @param {number} start
 * @returns {{ value: string|null, end: number }|null}
 */
function readJavaScriptLiteral(source, start) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;

  let value = '';
  let interpolated = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      if (index + 1 < source.length) {
        value += source[index + 1];
        index += 1;
      }
      continue;
    }
    if (quote === '`' && character === '$' && source[index + 1] === '{') {
      interpolated = true;
    }
    if (character === quote) {
      return {
        value: interpolated ? null : value,
        end: index + 1,
      };
    }
    value += character;
  }
  return null;
}

/**
 * Skip a JavaScript regular-expression literal so quote characters inside a
 * pattern cannot desynchronize the import scanner. The preceding-token check
 * distinguishes literals from division without attempting to parse all JS.
 *
 * @param {string} source
 * @param {number} start
 * @returns {{ end: number }|null}
 */
function readJavaScriptRegexLiteral(source, start) {
  if (
    source[start] !== '/' ||
    source[start + 1] === '/' ||
    source[start + 1] === '*'
  ) {
    return null;
  }

  let previous = start - 1;
  while (previous >= 0 && /\s/u.test(source[previous])) previous -= 1;
  const prefix = source.slice(Math.max(0, previous - 24), previous + 1);
  const followsRegexPunctuation =
    previous < 0 || /[([{:;,=!?&|+\-*%^~<>]/u.test(source[previous]);
  const followsRegexKeyword =
    /(?:^|[^A-Za-z0-9_$])(?:await|case|delete|in|instanceof|of|return|throw|typeof|void|yield)$/u.test(
      prefix,
    );
  if (!followsRegexPunctuation && !followsRegexKeyword) return null;

  let inCharacterClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '\n' || character === '\r') return null;
    if (character === '[') {
      inCharacterClass = true;
      continue;
    }
    if (character === ']') {
      inCharacterClass = false;
      continue;
    }
    if (character !== '/' || inCharacterClass) continue;
    let end = index + 1;
    while (/[A-Za-z]/u.test(source[end] ?? '')) end += 1;
    return { end };
  }
  return null;
}

/**
 * @param {string} source
 * @param {number} start
 * @returns {{ value: string, end: number }|null}
 */
function readJavaScriptIdentifier(source, start) {
  if (!/[A-Za-z_$]/u.test(source[start] ?? '')) return null;
  let end = start + 1;
  while (/[A-Za-z0-9_$]/u.test(source[end] ?? '')) end += 1;
  return { value: source.slice(start, end), end };
}

/**
 * @param {string} source
 * @returns {{ staticReferences: string[], dynamicReferences: string[] }}
 */
export function readBuiltImportReferences(source) {
  const staticReferences = new Set();
  const dynamicReferences = new Set();

  let index = 0;
  while (index < source.length) {
    index = skipJavaScriptIgnorables(source, index);
    if (index >= source.length) break;

    const literal = readJavaScriptLiteral(source, index);
    if (literal) {
      index = literal.end;
      continue;
    }

    const regexLiteral = readJavaScriptRegexLiteral(source, index);
    if (regexLiteral) {
      index = regexLiteral.end;
      continue;
    }

    const identifier = readJavaScriptIdentifier(source, index);
    if (!identifier) {
      index += 1;
      continue;
    }
    index = identifier.end;
    if (identifier.value !== 'import' && identifier.value !== 'export') {
      continue;
    }

    const afterKeyword = skipJavaScriptIgnorables(source, index);
    if (identifier.value === 'import' && source[afterKeyword] === '(') {
      const specifierStart = skipJavaScriptIgnorables(source, afterKeyword + 1);
      const specifier = readJavaScriptLiteral(source, specifierStart);
      if (specifier?.value) dynamicReferences.add(specifier.value);
      index = specifier?.end ?? specifierStart + 1;
      continue;
    }

    if (identifier.value === 'import') {
      const sideEffectSpecifier = readJavaScriptLiteral(source, afterKeyword);
      if (sideEffectSpecifier) {
        if (sideEffectSpecifier.value) {
          staticReferences.add(sideEffectSpecifier.value);
        }
        index = sideEffectSpecifier.end;
        continue;
      }
    }

    let clauseIndex = afterKeyword;
    while (clauseIndex < source.length) {
      clauseIndex = skipJavaScriptIgnorables(source, clauseIndex);
      if (clauseIndex >= source.length || source[clauseIndex] === ';') break;

      const clauseLiteral = readJavaScriptLiteral(source, clauseIndex);
      if (clauseLiteral) {
        clauseIndex = clauseLiteral.end;
        continue;
      }
      const clauseIdentifier = readJavaScriptIdentifier(source, clauseIndex);
      if (clauseIdentifier?.value === 'from') {
        const specifierStart = skipJavaScriptIgnorables(
          source,
          clauseIdentifier.end,
        );
        const specifier = readJavaScriptLiteral(source, specifierStart);
        if (specifier?.value) staticReferences.add(specifier.value);
        clauseIndex = specifier?.end ?? specifierStart + 1;
        break;
      }
      clauseIndex = clauseIdentifier?.end ?? clauseIndex + 1;
    }
    index = Math.max(index, clauseIndex);
  }

  return {
    staticReferences: [...staticReferences],
    dynamicReferences: [...dynamicReferences],
  };
}

/**
 * @param {string} path
 * @returns {{ staticReferences: string[], dynamicReferences: string[] }}
 */
export function readBuiltImports(path) {
  return readBuiltImportReferences(readFileSync(path, 'utf8'));
}

/**
 * Resolve a local emitted import from the importing asset. Browser-bare
 * imports are external and therefore do not name a build asset. A local import
 * that points at a missing emitted file is a broken measurement and fails
 * closed instead of silently undercounting.
 *
 * @param {string} reference
 * @param {string} importer
 * @param {Set<string>} clientAssetSet
 * @param {string} clientDirectory
 * @returns {string|null}
 */
function resolveBuiltImport(
  reference,
  importer,
  clientAssetSet,
  clientDirectory,
) {
  const cleanReference = reference.split(/[?#]/u, 1)[0];
  if (!cleanReference) return null;
  if (!cleanReference.startsWith('.') && !cleanReference.startsWith('/')) {
    return null;
  }
  const candidate = cleanReference.startsWith('/')
    ? resolve(clientDirectory, cleanReference.replace(/^\/+/, ''))
    : resolve(dirname(importer), cleanReference);
  if (!clientAssetSet.has(candidate)) {
    throw new Error(
      `Built browser asset ${importer} imports missing local asset ${reference}`,
    );
  }
  return candidate;
}

/**
 * @param {Iterable<string>} roots
 * @param {Set<string>} clientAssetSet
 * @param {string} clientDirectory
 * @returns {Set<string>}
 */
function collectBuiltStaticClosure(roots, clientAssetSet, clientDirectory) {
  const assets = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const path = pending.shift();
    if (!path || assets.has(path)) continue;
    if (!clientAssetSet.has(path)) {
      throw new Error(
        `Initial browser asset is missing from the build: ${path}`,
      );
    }
    assets.add(path);
    for (const reference of readBuiltImports(path).staticReferences) {
      const importedPath = resolveBuiltImport(
        reference,
        path,
        clientAssetSet,
        clientDirectory,
      );
      if (importedPath) pending.push(importedPath);
    }
  }
  return assets;
}

/**
 * Server-first workbench entries render their Runtime lazy component
 * unconditionally, so those dynamic edges are part of initial hydration.
 * Optional feature chunks rendered only after a user action remain deferred.
 *
 * @param {string} path
 * @returns {boolean}
 */
function isImmediateHydrationAsset(path) {
  return /^(?:InfrastructureWorkbenchRuntime|SettingsFlagsRuntimeWorkbenchRuntime)\.[^/]+\.(?:js|mjs)$/.test(
    basename(path),
  );
}

/**
 * @param {Set<string>} initialAssets
 * @param {Set<string>} clientAssetSet
 * @param {string} clientDirectory
 * @returns {Set<string>}
 */
function promoteImmediateHydrationAssets(
  initialAssets,
  clientAssetSet,
  clientDirectory,
) {
  let closure = initialAssets;
  while (true) {
    const promoted = [];
    for (const path of closure) {
      for (const reference of readBuiltImports(path).dynamicReferences) {
        const importedPath = resolveBuiltImport(
          reference,
          path,
          clientAssetSet,
          clientDirectory,
        );
        if (
          importedPath &&
          isImmediateHydrationAsset(importedPath) &&
          !closure.has(importedPath)
        ) {
          promoted.push(importedPath);
        }
      }
    }
    if (promoted.length === 0) return closure;
    closure = collectBuiltStaticClosure(
      [...closure, ...promoted],
      clientAssetSet,
      clientDirectory,
    );
  }
}

/**
 * Walk every deferred dynamic root, its static closure, and any nested dynamic
 * roots. Assets promoted to initial hydration are excluded from this set.
 *
 * @param {Set<string>} initialAssets
 * @param {Set<string>} clientAssetSet
 * @param {string} clientDirectory
 * @returns {Set<string>}
 */
function collectBuiltDeferredClosure(
  initialAssets,
  clientAssetSet,
  clientDirectory,
) {
  const deferredAssets = new Set();
  const pendingImporters = [...initialAssets];
  const inspected = new Set();

  while (pendingImporters.length > 0) {
    const importer = pendingImporters.shift();
    if (!importer || inspected.has(importer)) continue;
    inspected.add(importer);
    for (const reference of readBuiltImports(importer).dynamicReferences) {
      const dynamicRoot = resolveBuiltImport(
        reference,
        importer,
        clientAssetSet,
        clientDirectory,
      );
      if (!dynamicRoot || initialAssets.has(dynamicRoot)) continue;
      const dynamicClosure = collectBuiltStaticClosure(
        [dynamicRoot],
        clientAssetSet,
        clientDirectory,
      );
      for (const path of dynamicClosure) {
        if (!initialAssets.has(path) && !deferredAssets.has(path)) {
          deferredAssets.add(path);
          pendingImporters.push(path);
        }
      }
    }
  }

  return deferredAssets;
}

/**
 * @param {string} distDirectory
 * @param {string} path
 * @returns {BundleAsset}
 */
function measureAsset(distDirectory, path) {
  const absolutePath = resolve(distDirectory, path);
  const content = readFileSync(absolutePath);
  return {
    path,
    rawBytes: content.length,
    gzipBytes: gzipSync(content).length,
  };
}

/**
 * Measure the InfrastructureWorkbench island and its route's initial browser
 * JavaScript. The initial total includes the island, Astro/React runtimes,
 * and manifest-declared static imports. Lazy chunks are reported separately.
 *
 * @param {{
 *   distDirectory?: string,
 *   manifestPath?: string,
 *   entryName?: string,
 * }} [options]
 * @returns {BundleBudgetReport}
 */
export function measureBundleBudget({
  distDirectory = 'apps/web/dist',
  manifestPath,
  entryName = DEFAULT_ENTRY_NAME,
} = {}) {
  const entryStem = entryName.replace(/\.[^.]+$/u, '');
  const routeLabel =
    entryStem === 'InfrastructureWorkbench'
      ? 'Infrastructure'
      : entryStem === 'SettingsFlagsRuntimeWorkbench'
        ? 'Platform configuration'
        : entryStem === REGISTRY_ENTRY_STEM
          ? 'Content schema registry'
          : entryStem;
  const resolvedDistDirectory = resolve(distDirectory);
  const clientDirectory = join(resolvedDistDirectory, CLIENT_DIRECTORY);
  const absoluteClientAssets = findClientAssets(clientDirectory);
  const clientAssets = absoluteClientAssets.map((path) =>
    relative(resolvedDistDirectory, path),
  );
  const manifest = readManifest(resolvedDistDirectory, manifestPath);
  const initialAssetSet = new Set();
  const dynamicAssetSet = new Set();

  if (manifest) {
    const manifestEntryName = manifest.entries[entryName]
      ? entryName
      : Object.keys(manifest.entries).find((name) =>
          name.toLowerCase().includes(entryStem.toLowerCase()),
        );
    if (!manifestEntryName) {
      throw new Error(`${entryStem} entry is missing from the manifest`);
    }
    collectStaticManifestAssets(
      manifest.entries,
      manifestEntryName,
      initialAssetSet,
      new Set(),
      resolvedDistDirectory,
      manifest.path,
    );
    collectDynamicManifestAssets(
      manifest.entries,
      manifestEntryName,
      dynamicAssetSet,
      new Set(),
      resolvedDistDirectory,
      manifest.path,
    );
    for (const runtimePath of findAstroRuntimeAssets(clientAssets)) {
      initialAssetSet.add(runtimePath);
    }
    for (const routePath of findRouteAssets(clientAssets, entryStem)) {
      initialAssetSet.add(routePath);
    }
  } else {
    const browserEntry = findBrowserEntry(clientAssets, entryStem);
    if (!browserEntry) {
      throw new Error(`${entryStem} browser entry is missing from the build`);
    }
    initialAssetSet.add(browserEntry);
    for (const runtimePath of findAstroRuntimeAssets(clientAssets)) {
      initialAssetSet.add(runtimePath);
    }
    for (const routePath of findRouteAssets(clientAssets, entryStem)) {
      initialAssetSet.add(routePath);
    }
  }

  // A manifest identifies roots but does not encode whether a React.lazy edge
  // is rendered during the first hydration pass. Walk the emitted modules in
  // both modes so the immediate Workbench Runtime and every static dependency
  // are always charged to the initial route.
  const absoluteAssetSet = new Set(
    absoluteClientAssets.map((path) => resolve(path)),
  );
  const staticClosure = collectBuiltStaticClosure(
    [...initialAssetSet].map((path) => resolve(resolvedDistDirectory, path)),
    absoluteAssetSet,
    clientDirectory,
  );
  const initialClosure = promoteImmediateHydrationAssets(
    staticClosure,
    absoluteAssetSet,
    clientDirectory,
  );
  initialAssetSet.clear();
  for (const path of initialClosure) {
    initialAssetSet.add(relative(resolvedDistDirectory, path));
  }
  for (const path of collectBuiltDeferredClosure(
    initialClosure,
    absoluteAssetSet,
    clientDirectory,
  )) {
    dynamicAssetSet.add(relative(resolvedDistDirectory, path));
  }

  const normalizedInitialAssets = [...initialAssetSet]
    .filter((path) => clientAssets.includes(path))
    .sort();
  const normalizedDynamicAssets = [...dynamicAssetSet]
    .filter((path) => clientAssets.includes(path) && !initialAssetSet.has(path))
    .sort();
  const measuredInitial = normalizedInitialAssets.map((path) =>
    measureAsset(resolvedDistDirectory, path),
  );
  const lazyChunks = normalizedDynamicAssets.map((path) =>
    measureAsset(resolvedDistDirectory, path),
  );
  const escapedEntryStem = entryStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const workbenchPattern = new RegExp(
    `^${escapedEntryStem}\\.[^/]+\\.(?:js|mjs)$`,
  );
  const workbenchPath = normalizedInitialAssets.find((path) =>
    workbenchPattern.test(basename(path)),
  );
  if (!workbenchPath) {
    throw new Error(`${entryStem} browser entry is not an initial asset`);
  }
  const workbench = measuredInitial.find(
    (asset) => asset.path === workbenchPath,
  );
  if (!workbench) {
    throw new Error(`${entryStem} browser entry could not be measured`);
  }
  const workbenchClosure = promoteImmediateHydrationAssets(
    collectBuiltStaticClosure(
      [resolve(resolvedDistDirectory, workbenchPath)],
      absoluteAssetSet,
      clientDirectory,
    ),
    absoluteAssetSet,
    clientDirectory,
  );
  const workbenchAssets = [...workbenchClosure]
    .map((path) => relative(resolvedDistDirectory, path))
    .filter((path) => clientAssets.includes(path))
    .sort();
  const measuredWorkbench = workbenchAssets.map((path) =>
    measureAsset(resolvedDistDirectory, path),
  );
  const allClientGzipBytes = clientAssets.reduce(
    (total, path) =>
      total + measureAsset(resolvedDistDirectory, path).gzipBytes,
    0,
  );

  return {
    budgets: BUNDLE_BUDGETS,
    workbench,
    workbenchAssets,
    workbenchGzipBytes: measuredWorkbench.reduce(
      (total, asset) => total + asset.gzipBytes,
      0,
    ),
    initialAssets: normalizedInitialAssets,
    initialRouteGzipBytes: measuredInitial.reduce(
      (total, asset) => total + asset.gzipBytes,
      0,
    ),
    lazyAssets: normalizedDynamicAssets,
    lazyChunks,
    lazyChunkGzipBytes: lazyChunks.map((asset) => asset.gzipBytes),
    allClientGzipBytes,
    manifestPath: manifest?.path ?? null,
    workbenchLabel: entryStem,
    routeLabel,
  };
}

/**
 * @param {BundleBudgetReport} report
 * @returns {string[]}
 */
export function bundleBudgetFailures(report) {
  const failures = [];
  const workbenchLabel = report.workbenchLabel ?? 'InfrastructureWorkbench';
  const routeLabel = report.routeLabel ?? 'Infrastructure';
  if (report.workbenchGzipBytes > report.budgets.workbenchGzipBytes) {
    failures.push(
      `${workbenchLabel} exceeds ${report.budgets.workbenchGzipBytes} gzip bytes: ${report.workbenchGzipBytes}`,
    );
  }
  if (report.initialRouteGzipBytes > report.budgets.initialRouteGzipBytes) {
    failures.push(
      `${routeLabel} initial route exceeds ${report.budgets.initialRouteGzipBytes} gzip bytes: ${report.initialRouteGzipBytes}`,
    );
  }
  for (const chunk of report.lazyChunks) {
    if (chunk.gzipBytes > report.budgets.lazyChunkGzipBytes) {
      failures.push(
        `Lazy chunk ${chunk.path} exceeds ${report.budgets.lazyChunkGzipBytes} gzip bytes: ${chunk.gzipBytes}`,
      );
    }
  }
  return failures;
}

/**
 * @param {BundleBudgetReport} report
 * @returns {void}
 */
export function assertBundleBudget(report) {
  const failures = bundleBudgetFailures(report);
  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

/**
 * Add the immutable promotion fields to the human-readable budget report.
 * Direct callers can continue to inspect the structural report; CI and
 * staging consume this explicitly versioned evidence shape.
 */
export const formatBundleBudgetEvidence = (report, sourceRevision) => {
  const failures = bundleBudgetFailures(report);
  return {
    ...report,
    sourceRevision: sourceRevision ?? resolveSourceRevision(),
    thresholds: report.budgets,
    passed: failures.length === 0,
  };
};

async function main() {
  const distDirectory = process.argv[2] ?? 'apps/web/dist';
  const manifestOption =
    process.argv[3] === undefined ? {} : { manifestPath: process.argv[3] };
  const report = measureBundleBudget({ distDirectory, ...manifestOption });
  const platformConfiguration = measureBundleBudget({
    distDirectory,
    ...manifestOption,
    entryName: 'SettingsFlagsRuntimeWorkbench.tsx',
  });
  const contentSchemaRegistry = measureBundleBudget({
    distDirectory,
    ...manifestOption,
    entryName: `${REGISTRY_ENTRY_STEM}.tsx`,
  });
  const sourceRevision = resolveSourceRevision();
  console.log(
    JSON.stringify(
      {
        ...formatBundleBudgetEvidence(report, sourceRevision),
        platformConfiguration: formatBundleBudgetEvidence(
          platformConfiguration,
          sourceRevision,
        ),
        contentSchemaRegistry: formatBundleBudgetEvidence(
          contentSchemaRegistry,
          sourceRevision,
        ),
      },
      null,
      2,
    ),
  );
  assertBundleBudget(report);
  assertBundleBudget(platformConfiguration);
  assertBundleBudget(contentSchemaRegistry);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'Bundle budget verification failed',
    );
    process.exitCode = 1;
  });
}
