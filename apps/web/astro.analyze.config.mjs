import base from './astro.config.mjs';
import { clientChunkFor } from './client-chunk-boundaries.mjs';
import { appendFileSync } from 'node:fs';
export default {
  ...base,
  outDir: '/tmp/claude-1000/-home-rob-Projects-WeJammin/8b84077b-05a3-4143-a4a7-ae46900e86e6/scratchpad/analyze-dist',
  vite: { ...base.vite, build: { ...base.vite.build, sourcemap: true, rollupOptions: { output: { manualChunks: (id, meta) => { const r = clientChunkFor(id); if (id.includes('packages/contracts/src/') && /locale-canonical|return-target|locale-config-rules|template-binding|route-policy-base|client\.ts/.test(id)) appendFileSync('/tmp/claude-1000/-home-rob-Projects-WeJammin/8b84077b-05a3-4143-a4a7-ae46900e86e6/scratchpad/logs/manual-chunks-probe.log', id + ' -> ' + r + '\n'); return r; } } } } },
};
