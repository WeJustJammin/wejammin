import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

/**
 * Every page of the CMS content-modeling route tree
 * (`apps/web/src/pages/app/cms-content-modeling`), the React island it
 * hydrates and the scripts its document shell adds to the route. `pnpm
 * bundle:check` charges each measured route against `BUNDLE_BUDGETS`; a test
 * (`tests/performance/cms-editorial-bundle-budget.test.ts`) fails when a page
 * or island is missing from this table, so a new route cannot ship unmeasured.
 *
 * - `island` is the primary island; `extraIslands` are the others the same page
 *   hydrates. The page is charged for all of them, and each is held to the
 *   island budget on its own.
 * - `routeScripts: 'cms-editorial-document'`: the page renders
 *   `CmsEditorialDocument.astro`, whose three bundled scripts (route heading
 *   focus, cross-tab auth scope, page actions) load with every such route.
 *   `pageActions: true` marks a route whose markup holds a form the page-actions script serves (the
 *   create type selector, the restore review): the shell adds `CmsEditorialPageActions.astro`'s
 *   script there and nowhere else, and this route is charged for it.
 * - `routeScripts: 'page-shell'`: the page carries its own route-heading and
 *   auth-scope `<script src>` tags; `pageScript` is the emitted script stem.
 * - `measuredBy`: the route is measured by an existing measurement in `main`.
 *
 * @typedef {{
 *   name: string,
 *   page: string,
 *   island: string|null,
 *   extraIslands?: readonly string[],
 *   routeScripts: 'cms-editorial-document'|'page-shell',
 *   pageActions?: boolean,
 *   pageScript?: string,
 *   measuredBy?: 'content-schema-registry',
 * }} CmsEditorialRoute
 */
export const CMS_EDITORIAL_ROUTES = Object.freeze(
  /** @type {readonly CmsEditorialRoute[]} */ ([
    {
      name: 'Content schema registry',
      page: 'index.astro',
      island: REGISTRY_ENTRY_STEM,
      routeScripts: 'page-shell',
      pageScript: 'index',
      measuredBy: 'content-schema-registry',
    },
    {
      name: 'Content schema registry version',
      page: '[contentTypeId]/versions/[versionId].astro',
      island: REGISTRY_ENTRY_STEM,
      routeScripts: 'page-shell',
      pageScript: '_versionId_',
      measuredBy: 'content-schema-registry',
    },
    {
      name: 'Content schema registry review',
      page: 'schema-reviews/[reviewId].astro',
      island: REGISTRY_ENTRY_STEM,
      routeScripts: 'page-shell',
      pageScript: '_reviewId_',
      measuredBy: 'content-schema-registry',
    },
    {
      name: 'CMS capability grants',
      page: 'capability-grants.astro',
      island: 'CmsCapabilityGrantConsoleIsland',
      routeScripts: 'page-shell',
      pageScript: 'capability-grants',
    },
    {
      name: 'CMS entry list',
      page: 'entries/index.astro',
      island: null,
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS entry create',
      page: 'entries/new.astro',
      island: 'CmsEditorialEntryCreateIsland',
      routeScripts: 'cms-editorial-document',
      pageActions: true,
    },
    {
      name: 'CMS entry editor',
      page: 'entries/[entryId].astro',
      island: 'CmsEditorialEntryEditorIsland',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS revision history',
      page: 'entries/[entryId]/revisions.astro',
      island: null,
      routeScripts: 'cms-editorial-document',
      pageActions: true,
    },
    {
      name: 'CMS entry workflow',
      page: 'entries/[entryId]/workflow.astro',
      island: 'CmsEditorialWorkflowIsland',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS related content',
      page: 'entries/[entryId]/related-content.astro',
      island: 'CmsRelatedContentForm',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS composition',
      page: 'entries/[entryId]/composition.astro',
      island: 'CmsCompositionPage',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS locale variant',
      page: 'entries/[entryId]/locales/[locale].astro',
      island: 'CmsLocaleVariantForm',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS conflict resolve',
      page: 'entries/[entryId]/conflicts/[conflictId].astro',
      island: 'CmsEditorialConflictResolveIsland',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS review queue',
      page: 'reviews/index.astro',
      island: null,
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS review detail',
      page: 'reviews/[reviewId].astro',
      island: 'CmsEditorialReviewDetailIsland',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS definition review queue',
      page: 'definition-reviews/index.astro',
      island: null,
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS definition review detail',
      page: 'definition-reviews/[reviewId].astro',
      island: 'CmsGovernedReviewDetailIsland',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS pattern create',
      page: 'patterns/new.astro',
      island: 'CmsPatternVersionDesigner',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS pattern edit',
      page: 'patterns/[patternKey].astro',
      island: 'CmsPatternVersionDesigner',
      extraIslands: ['CmsGovernedPatternPanel'],
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS taxonomy create',
      page: 'taxonomies/new.astro',
      island: 'CmsTaxonomyVersionDesigner',
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS taxonomy edit',
      page: 'taxonomies/[taxonomyId].astro',
      island: 'CmsTaxonomyVersionDesigner',
      extraIslands: ['CmsGovernedTaxonomyPanel', 'CmsTaxonomyTermForm'],
      routeScripts: 'cms-editorial-document',
    },
    {
      name: 'CMS template create',
      page: 'templates/new.astro',
      island: 'CmsTemplateDesigner',
      routeScripts: 'page-shell',
      pageScript: 'new',
    },
    {
      name: 'CMS template edit',
      page: 'templates/[templateKey].astro',
      island: 'CmsTemplateEditDesigner',
      extraIslands: ['CmsGovernedTemplatePanel'],
      routeScripts: 'page-shell',
      pageScript: '_templateKey_',
    },
  ]),
);

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
 *   islands: { name: string, gzipBytes: number }[],
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
 * The scripts a CMS route loads beside its island. A route fails closed when
 * the build holds none of them: a renamed shell script would otherwise leave
 * the route silently undercounted.
 *
 * @param {string[]} clientAssets
 * @param {CmsEditorialRoute} route
 * @returns {string[]}
 */
function findCmsRouteScriptAssets(clientAssets, route) {
  const stems =
    route.routeScripts === 'cms-editorial-document'
      ? [
          { stem: 'CmsEditorialDocument', label: 'route scripts' },
          ...(route.pageActions
            ? [{ stem: 'CmsEditorialPageActions', label: 'page actions' }]
            : []),
        ]
      : [{ stem: route.pageScript, label: 'route scripts' }];
  return stems.flatMap(({ stem, label }) => {
    if (!stem) throw new Error(`${route.name} declares no route script stem`);
    const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^${escapedStem}\\.astro_astro_type_script_index_\\d+_lang\\.[^/]+\\.(?:js|mjs)$`,
      'u',
    );
    const scripts = clientAssets.filter((path) => pattern.test(basename(path)));
    if (scripts.length === 0) {
      throw new Error(
        `${route.name} ${label} (${stem}) are missing from the build`,
      );
    }
    return scripts;
  });
}

/**
 * @param {string[]} clientAssets
 * @param {string|null} entryStem
 * @param {CmsEditorialRoute|null} [route]
 * @returns {string[]}
 */
function findRouteAssets(clientAssets, entryStem, route = null) {
  if (route) return findCmsRouteScriptAssets(clientAssets, route);
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
    // The registry routes load shared heading and auth-scope scripts beside
    // their island; the island's static closure does not include them.
    return clientAssets.filter((path) =>
      /^(?:route-heading-focus|auth-scope-sync)\.[^/]+\.(?:js|mjs)$/.test(
        basename(path),
      ),
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
 * The chunks a CMS island loads only because the person did something. Chrome
 * (`phase-02-slice-11-bundle-budget-real-route.spec.ts`) charges a route for every script it fetches
 * until the page is idle, so a lazy chunk the island fetches without the person doing anything (a
 * command form mounted at hydration, a read made by a mount effect, a result waiting after a
 * navigation) is part of the cold load even though it is a dynamic import. A route is therefore
 * charged for its static closure PLUS every dynamic edge of that closure that is not listed here,
 * followed transitively. An entry may be listed only when
 * - `trigger` names the person's own event that loads it (a pointer, touch, focus or key in a region,
 *   a send, a save, an open): never visibility, scrolling, time, viewport size or the arrival on a
 *   page, and never a mount effect that reads on its own;
 * - `importedBy` lists every source file that holds a dynamic `import()` of it (`specifier` names a
 *   package entry where the chunk is not a source module), and a test fails when the source holds
 *   another one: a new call site is a new trigger to prove;
 * - `proof` names a test, with the stem in the title (`it('<stem>: ...')`), that mounts the real
 *   surface and shows the module is not requested before the trigger and is requested by it;
 * - `chargedOn` lists the routes where the chunk does load without a trigger, if there are any:
 *   they are charged for it as if it were not listed.
 * Landing-dependent chunks (the result a committed command left for the editor page) are not listed.
 * A new lazy chunk is charged until someone lists it, which keeps the gate and the browser in step.
 * `stem` is the emitted chunk name without its content hash.
 */
export const CMS_ON_DEMAND_CHUNKS = Object.freeze([
  {
    stem: 'contracts',
    trigger: 'focus or send',
    reason:
      'The Zod contract schemas load with the first check that needs them: a form takes focus, a command is sent, a read is verified. No mount effect asks for them (the reviewer choices wait for intent in the assignment form).',
    importedBy: [],
    specifier: '@wejammin/contracts',
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'validators',
    trigger: 'focus or send',
    reason:
      'The curated validator list loads with the first check of a read, a body or an answer, never at mount.',
    importedBy: ['apps/web/src/lib/cms-contract-validators.ts'],
    specifier: '@wejammin/contracts/cms-editorial/validators',
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'contracts-time-authority',
    trigger: 'open schedule form',
    reason:
      'The pinned tz snapshot loads when the person opens the schedule form, or returns to it from their own step-up verification with a kept draft (BE03b E8, P2-S11-AC-106).',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/use-cms-schedule-time.ts',
    ],
    specifier: '@wejammin/contracts/time-authority',
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'time-authority',
    trigger: 'open schedule form',
    reason:
      'The module that loads the pinned tz snapshot, imported when the person opens the schedule form or returns to it from their own step-up verification.',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/use-cms-schedule-time.ts',
    ],
    specifier: '@wejammin/contracts/time-authority',
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'cms-workflow-command-transport',
    trigger: 'focus or send',
    reason:
      'The command transport loads with the first send of a workflow command, or when a form takes focus.',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/cms-workflow-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'cms-workflow-refusal',
    trigger: 'focus or refused command',
    reason:
      'The fixed refusal copy loads when a form takes focus (the classifier is warmed with the transport) or with the first refused workflow command.',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/cms-workflow-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'cms-workflow-canonical-read',
    trigger: 'refetch after a command',
    reason:
      'The canonical workflow read runs only on a refetch after a command or a lost answer.',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/cms-workflow-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'CmsGovernedSubmitForm',
    trigger: 'pointer, touch, focus or key in its region',
    reason:
      'The submit form of a governed panel loads on the first pointer, touch, focus or key in its region (cms-lazy-intent.ts); never on scroll, time or viewport size. It is a button with no field.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-panel-form-views.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'CmsGovernedDecisionForm',
    trigger: 'pointer, touch, focus or key in its region',
    reason:
      'The decision form of a governed review loads on the first pointer, touch, focus or key in its region; never on scroll, time or viewport size. Until it hydrates the server-written controls are native and what is entered is kept.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-review-form-views.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'CmsGovernedAssignmentForm',
    trigger: 'pointer, touch, focus or key in its region',
    reason:
      'The assignment forms of a governed review load on the first pointer, touch, focus or key in their region; never on scroll, time or viewport size. Until they hydrate the server-written controls are native and what is entered is kept.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-review-form-views.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'CmsGovernedActivationForm',
    trigger: 'pointer, touch, focus or key in its region',
    reason:
      'The activation form of a governed review loads on the first pointer, touch, focus or key in its region; never on scroll, time or viewport size. Until it hydrates the server-written controls are native and what is entered is kept.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-review-form-views.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'CmsEditorialReviewAssignmentForm',
    trigger: 'pointer, touch, focus or key in its region',
    reason:
      'The owner-only assign and revoke forms of an editorial review load on the first pointer, touch, focus or key in their region (cms-lazy-intent.ts); never on scroll, time or viewport size. Until they hydrate the server-written controls are native and what was entered is kept.',
    importedBy: [
      'apps/web/src/components/cms-editorial-workflow/cms-review-form-views.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial-workflow/cms-on-demand-workflow.proof.test.tsx',
    },
  },
  {
    stem: 'governed-review-command-transport',
    trigger: 'focus or send',
    reason:
      'The governed command transport loads with the first send of a governed command, or when a form takes focus.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'governed-review-refusal',
    trigger: 'focus or refused command',
    reason:
      'The fixed governed and activation refusal copy loads when a form takes focus (it is warmed with the transport) or with the first refused governed command.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'governed-review-canonical-read',
    trigger: 'refetch after a command',
    reason:
      'The canonical governed review read runs only on a refetch after a command or a lost answer.',
    importedBy: [
      'apps/web/src/components/cms-governed-review/governed-answer-machinery.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-governed-review/cms-on-demand-governed.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-page-actions-restore',
    trigger: 'open restore review or confirm',
    reason:
      'The restore command loads when the restore review opens or its confirmation is submitted.',
    importedBy: ['apps/web/src/lib/cms-editorial-page-actions-dom.ts'],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-entry-editor-save',
    trigger: 'first save',
    reason:
      'The save flow of the entry editor (request, outcomes, stale-base handling) loads with the first save, after the author has edited.',
    importedBy: [
      'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-controller.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'locale-variant-submit',
    trigger: 'save',
    reason: 'The locale variant save loads when the person saves.',
    importedBy: [
      'apps/web/src/components/cms-locale/use-locale-variant-form.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'locale-source-refresh',
    trigger: '409 on save',
    reason:
      'The source review read loads after a 409 asks the person to review the source.',
    importedBy: [
      'apps/web/src/components/cms-locale/use-locale-source-review.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'taxonomy-designer-submit',
    trigger: 'save',
    reason: 'The vocabulary version write loads when the person saves.',
    importedBy: [
      'apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'term-action-submit',
    trigger: 'term action',
    reason: 'The term action write loads when the person acts on a term.',
    importedBy: ['apps/web/src/components/cms-taxonomy-terms/use-term-form.ts'],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'CmsTaxonomyTermAction',
    trigger: 'open a term action',
    reason:
      'The term action form (fields, review step, parent choices) is client state: it exists only after the person pressed Create a term or a table action, and loads then. A load slower than 250 ms shows the loading state (P2-S12-AC-271).',
    importedBy: [
      'apps/web/src/components/cms-taxonomy-terms/term-action-view.tsx',
    ],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'taxonomy-outcome-reconcile',
    trigger: 'lost write outcome',
    reason:
      'The check of a vocabulary write whose outcome was lost runs after that write.',
    importedBy: [
      'apps/web/src/components/cms-taxonomy-designer/use-taxonomy-designer.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-on-demand-taxonomy-locale.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-restore-draft',
    trigger: 'open or close a restore review',
    reason:
      'The restore confirmation draft store loads when a restore review opens or closes. The revision history looks for its restore form when the page loads, so that route is charged for it.',
    importedBy: ['apps/web/src/lib/cms-editorial-page-actions-dom.ts'],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
    chargedOn: ['CMS revision history'],
  },
  {
    stem: 'cms-editorial-runtime',
    trigger: 'first save',
    reason:
      'The entry save runtime loads with the first save of the editor island.',
    importedBy: [
      'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-save.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-entry-draft-detail-transport',
    trigger: 'conflict or refetch',
    reason:
      'The draft detail read loads when the editor or the conflict page reads the draft again.',
    importedBy: [
      'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.ts',
      'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-context.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-entry-create-submit',
    trigger: 'first submit',
    reason:
      'The create command loads with the first submit of the create form.',
    importedBy: [
      'apps/web/src/components/cms-editorial/use-cms-editorial-entry-create.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-conflict-resolve',
    trigger: 'first resolution',
    reason: 'The resolve command loads with the first submit of a resolution.',
    importedBy: [
      'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
  {
    stem: 'cms-editorial-conflict-detail-transport',
    trigger: 'conflict re-read',
    reason:
      'The conflict detail read loads when the page reads the conflict again.',
    importedBy: [
      'apps/web/src/components/cms-editorial/cms-editorial-conflict-controller.ts',
    ],
    proof: {
      file: 'apps/web/src/components/cms-editorial/cms-on-demand-editor.proof.test.tsx',
    },
  },
]);

/**
 * @param {string} path
 * @param {CmsEditorialRoute|null} route
 * @returns {boolean}
 */
function isOnDemandAsset(path, route) {
  const name = basename(path);
  return CMS_ON_DEMAND_CHUNKS.some(
    ({ stem, chargedOn }) =>
      name.startsWith(`${stem}.`) && !(chargedOn ?? []).includes(route?.name),
  );
}

/**
 * A CMS route is charged for the lazy chunks its mounted islands fetch at hydration: every dynamic
 * edge of the closure that is not on demand, with its static closure, followed until none is left.
 *
 * @param {Set<string>} initialAssets
 * @param {Set<string>} clientAssetSet
 * @param {string} clientDirectory
 * @param {CmsEditorialRoute} route
 * @returns {Set<string>}
 */
function promoteMountedLazyAssets(
  initialAssets,
  clientAssetSet,
  clientDirectory,
  route,
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
          !closure.has(importedPath) &&
          !isOnDemandAsset(importedPath, route)
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
 * The island entry, its static closure and their measured sizes.
 *
 * @param {{
 *   entryStem: string,
 *   normalizedInitialAssets: string[],
 *   measuredInitial: BundleAsset[],
 *   clientAssets: string[],
 *   resolvedDistDirectory: string,
 *   absoluteAssetSet: Set<string>,
 *   clientDirectory: string,
 * }} input
 * @returns {{ workbench: BundleAsset, workbenchAssets: string[], measuredWorkbench: BundleAsset[] }}
 */
function measureWorkbench({
  entryStem,
  normalizedInitialAssets,
  measuredInitial,
  clientAssets,
  resolvedDistDirectory,
  absoluteAssetSet,
  clientDirectory,
}) {
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
  return { workbench, workbenchAssets, measuredWorkbench };
}

/**
 * Measure the InfrastructureWorkbench island and its route's initial browser
 * JavaScript. The initial total includes the island, Astro/React runtimes,
 * and manifest-declared static imports. Lazy chunks are reported separately.
 *
 * A CMS editorial `route` (see `CMS_EDITORIAL_ROUTES`) adds the scripts its
 * document shell loads with the island and names the route in failures; a
 * route with no island (`entryName: null`) loads no Astro or React runtime and
 * is charged for those scripts alone.
 *
 * A page that hydrates more than one island passes the others as
 * `companionEntryNames`: their entries and static closures join the initial
 * route, and each is measured on its own (`islands`) for the island budget.
 *
 * @param {{
 *   distDirectory?: string,
 *   manifestPath?: string,
 *   entryName?: string|null,
 *   companionEntryNames?: readonly string[],
 *   route?: CmsEditorialRoute|null,
 * }} [options]
 * @returns {BundleBudgetReport}
 */
export function measureBundleBudget({
  distDirectory = 'apps/web/dist',
  manifestPath,
  entryName = DEFAULT_ENTRY_NAME,
  companionEntryNames = [],
  route = null,
} = {}) {
  const entryStem =
    entryName === null ? null : entryName.replace(/\.[^.]+$/u, '');
  const companionStems = companionEntryNames.map((name) =>
    name.replace(/\.[^.]+$/u, ''),
  );
  const routeLabel =
    route !== null
      ? route.name
      : entryStem === 'InfrastructureWorkbench'
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

  if (entryStem === null) {
    for (const routePath of findRouteAssets(clientAssets, entryStem, route)) {
      initialAssetSet.add(routePath);
    }
  } else if (manifest) {
    for (const [name, stem] of [
      [entryName, entryStem],
      ...companionEntryNames.map((name, index) => [
        name,
        companionStems[index],
      ]),
    ]) {
      const manifestEntryName = manifest.entries[name]
        ? name
        : Object.keys(manifest.entries).find((candidate) =>
            candidate.toLowerCase().includes(stem.toLowerCase()),
          );
      if (!manifestEntryName) {
        throw new Error(`${stem} entry is missing from the manifest`);
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
    }
    for (const runtimePath of findAstroRuntimeAssets(clientAssets)) {
      initialAssetSet.add(runtimePath);
    }
    for (const routePath of findRouteAssets(clientAssets, entryStem, route)) {
      initialAssetSet.add(routePath);
    }
  } else {
    for (const stem of [entryStem, ...companionStems]) {
      const browserEntry = findBrowserEntry(clientAssets, stem);
      if (!browserEntry) {
        throw new Error(`${stem} browser entry is missing from the build`);
      }
      initialAssetSet.add(browserEntry);
    }
    for (const runtimePath of findAstroRuntimeAssets(clientAssets)) {
      initialAssetSet.add(runtimePath);
    }
    for (const routePath of findRouteAssets(clientAssets, entryStem, route)) {
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
    route === null
      ? staticClosure
      : promoteMountedLazyAssets(
          staticClosure,
          absoluteAssetSet,
          clientDirectory,
          route,
        ),
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
  const { workbench, workbenchAssets, measuredWorkbench } =
    entryStem === null
      ? {
          workbench: { path: '', rawBytes: 0, gzipBytes: 0 },
          workbenchAssets: [],
          measuredWorkbench: [],
        }
      : measureWorkbench({
          entryStem,
          normalizedInitialAssets,
          measuredInitial,
          clientAssets,
          resolvedDistDirectory,
          absoluteAssetSet,
          clientDirectory,
        });
  const islands =
    entryStem === null
      ? []
      : [
          {
            name: entryStem,
            gzipBytes: measuredWorkbench.reduce(
              (total, asset) => total + asset.gzipBytes,
              0,
            ),
          },
          ...companionStems.map((stem) => ({
            name: stem,
            gzipBytes: measureWorkbench({
              entryStem: stem,
              normalizedInitialAssets,
              measuredInitial,
              clientAssets,
              resolvedDistDirectory,
              absoluteAssetSet,
              clientDirectory,
            }).measuredWorkbench.reduce(
              (total, asset) => total + asset.gzipBytes,
              0,
            ),
          })),
        ];
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
    islands,
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
  // Every island beyond the primary one (reported above) is held to the same budget.
  for (const island of (report.islands ?? []).slice(1)) {
    if (island.gzipBytes > report.budgets.workbenchGzipBytes) {
      failures.push(
        `${island.name} exceeds ${report.budgets.workbenchGzipBytes} gzip bytes: ${island.gzipBytes}`,
      );
    }
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
 * Measure one CMS editorial route: its island (if any), the Astro and React
 * runtimes the island needs, and the scripts its document shell loads.
 *
 * @param {CmsEditorialRoute} route
 * @param {{ distDirectory?: string, manifestPath?: string }} [options]
 * @returns {BundleBudgetReport}
 */
export function measureCmsEditorialRoute(
  route,
  { distDirectory, manifestPath } = {},
) {
  return measureBundleBudget({
    ...(distDirectory === undefined ? {} : { distDirectory }),
    ...(manifestPath === undefined ? {} : { manifestPath }),
    entryName: route.island === null ? null : `${route.island}.tsx`,
    companionEntryNames: (route.extraIslands ?? []).map(
      (island) => `${island}.tsx`,
    ),
    route,
  });
}

/**
 * Measure every CMS editorial route that no other measurement already owns
 * (the registry routes are measured by `main`).
 *
 * @param {{ distDirectory?: string, manifestPath?: string }} [options]
 * @returns {BundleBudgetReport[]}
 */
export function measureCmsEditorialRoutes(options = {}) {
  return CMS_EDITORIAL_ROUTES.filter(
    (route) => route.measuredBy === undefined,
  ).map((route) => measureCmsEditorialRoute(route, options));
}

/**
 * Every failure of every route, so one run names all the routes to fix. A lazy
 * chunk several routes share is reported once.
 *
 * @param {BundleBudgetReport[]} reports
 * @returns {string[]}
 */
export function cmsEditorialBundleBudgetFailures(reports) {
  return [
    ...new Set(reports.flatMap((report) => bundleBudgetFailures(report))),
  ];
}

/**
 * The gate counts gzip bytes, and the bytes depend on the zlib of the Node that measures: every CMS
 * route grew 660 to 801 bytes under Node 26 against the pinned release. The measurement is only
 * valid under the version `.node-version` pins (CI installs exactly that), so any other version is
 * a failure, not a warning.
 *
 * @param {string} actual `process.version`, for example `v22.23.1`
 * @param {string|null} pinned the content of `.node-version`, or null when it cannot be read
 * @returns {string|null}
 */
export function pinnedNodeFailure(actual, pinned) {
  const pin = (pinned ?? '').trim();
  if (pin === '')
    return 'Cannot read the pinned Node version from .node-version, so the gzip sizes cannot be trusted.';
  if (actual.replace(/^v/u, '') === pin) return null;
  return `The bundle gate measures gzip bytes and must run under the pinned Node ${pin} (.node-version); this is ${actual}.`;
}

/**
 * The gate reads whatever `apps/web/dist` holds. A development-mode build (it carries the React
 * development runtime) or a build for a named environment (`targetEnvironment` in the server
 * `wrangler.json`, for example staging) is not the production artifact the budget describes, and a
 * dist with no server build is not a finished build at all.
 *
 * @param {string} distDirectory
 * @returns {string[]}
 */
export function distProvenanceFailures(distDirectory) {
  const root = resolve(distDirectory);
  const failures = [];
  const wranglerPath = join(root, 'server', 'wrangler.json');
  if (!existsSync(wranglerPath)) {
    failures.push(
      `${distDirectory} has no server/wrangler.json: it is not a finished production build. Run a fresh production build (pnpm --filter web build) first.`,
    );
  } else {
    /** @type {{ targetEnvironment?: unknown }} */
    let wrangler = {};
    try {
      wrangler = JSON.parse(readFileSync(wranglerPath, 'utf8'));
    } catch {
      failures.push(`${distDirectory}/server/wrangler.json is not valid JSON.`);
    }
    if (wrangler.targetEnvironment !== undefined)
      failures.push(
        `${distDirectory} was built for the "${String(wrangler.targetEnvironment)}" environment (server/wrangler.json targetEnvironment), not as the production build the budget describes. Run a fresh production build.`,
      );
  }
  const clientDirectory = join(root, CLIENT_DIRECTORY);
  if (existsSync(clientDirectory)) {
    const development = findClientAssets(clientDirectory).find((asset) =>
      readFileSync(asset, 'utf8').includes('jsx-dev-runtime'),
    );
    if (development !== undefined)
      failures.push(
        `${distDirectory} carries the React development runtime (jsx-dev-runtime in ${relative(root, development)}): it is a development build. Run a fresh production build.`,
      );
  }
  return failures;
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
  const pinnedNode = existsSync('.node-version')
    ? readFileSync('.node-version', 'utf8')
    : null;
  const environmentFailures = [
    pinnedNodeFailure(process.version, pinnedNode),
    ...distProvenanceFailures(distDirectory),
  ].filter((failure) => failure !== null);
  if (environmentFailures.length > 0)
    throw new Error(environmentFailures.join('\n'));
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
  const cmsEditorial = measureCmsEditorialRoutes({
    distDirectory,
    ...manifestOption,
  });
  const sourceRevision = resolveSourceRevision();
  console.log(
    JSON.stringify(
      {
        ...formatBundleBudgetEvidence(report, sourceRevision),
        measuredWith: { node: process.version, pinnedNode: pinnedNode?.trim() },
        platformConfiguration: formatBundleBudgetEvidence(
          platformConfiguration,
          sourceRevision,
        ),
        contentSchemaRegistry: formatBundleBudgetEvidence(
          contentSchemaRegistry,
          sourceRevision,
        ),
        cmsEditorial: cmsEditorial.map((route) =>
          formatBundleBudgetEvidence(route, sourceRevision),
        ),
      },
      null,
      2,
    ),
  );
  const failures = [
    ...bundleBudgetFailures(report),
    ...bundleBudgetFailures(platformConfiguration),
    ...bundleBudgetFailures(contentSchemaRegistry),
    ...cmsEditorialBundleBudgetFailures(cmsEditorial),
  ];
  if (failures.length > 0) throw new Error(failures.join('\n'));
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
