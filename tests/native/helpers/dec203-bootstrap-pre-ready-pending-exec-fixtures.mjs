const ownerRoot = '/owned-run';
const ownerPath = '/owned-run/owner/receiving-lease-owner';
const outer = Object.freeze({
  process: Object.freeze({ pid: 501, uid: 1000, session: 401 }),
  group: 401,
  namespace: 'pid:[701]',
});
const compilerCore = Object.freeze({
  pid: 601,
  ppid: 501,
  startTime: '9001',
  session: 601,
  uid: 1000,
});
const compilerBracket = Object.freeze({
  process: Object.freeze({
    ...compilerCore,
    executable: Object.freeze({ path: '/gcc' }),
  }),
  group: 601,
  namespace: 'pid:[701]',
});
const ownerCore = Object.freeze({
  pid: 701,
  ppid: 501,
  startTime: '9002',
  session: 401,
  uid: 1000,
});
const ownerRaw = Object.freeze({
  ...ownerCore,
  group: 401,
  image: '/node',
  namespace: 'pid:[701]',
});
const ownerBracket = Object.freeze({
  process: Object.freeze({
    ...ownerCore,
    executable: Object.freeze({ path: ownerPath }),
  }),
  group: 401,
  namespace: 'pid:[701]',
  cwd: ownerRoot,
  argv: Object.freeze([ownerPath, '00000000-0000-4000-8000-000000000001']),
});
const compilerRaw = Object.freeze({
  pid: 601,
  ppid: 501,
  group: 601,
  session: 601,
  startTime: '9001',
  uid: 1000,
  image: '/node',
  namespace: 'pid:[701]',
});
export {
  outer,
  compilerCore,
  compilerRaw,
  compilerBracket,
  ownerRoot,
  ownerPath,
  ownerRaw,
  ownerBracket,
};
