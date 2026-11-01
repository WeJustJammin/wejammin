# DEC-203 Linux history source notes

Root public primary-source research, 2026-10-18. No ptrace, process probe,
supervisor, Docker operation, policy change or native acceptance was performed.
These are pinned Linux v6.17 source semantics, not proof of the local custom
kernel's complete behavior. Actual native support and race tests remain required.

## Creation coverage

[kernel/fork.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/kernel/fork.c)
2589–2604 skips ptrace creation-event selection when CLONE_UNTRACED is present.
The ordinary path chooses vfork/clone/fork according to flags and exit signal,
then checks the relevant ptrace event option. Event flags alone therefore do
not prove universal creation coverage.

The same file's create_io_thread path around2540–2555 constructs an untraced
user-worker and calls copy_process with trace0. Denying only ordinary clone's
untraced flag does not independently close io_uring-created worker escape.
The supervisor proposal must explicitly close every admitted creation/escape
route or retain an open completeness boundary. A one-time read of clone3's
user-memory flags is not a proved TOCTOU-safe admission rule.

## Nonleader exec

[fs/exec.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/fs/exec.c)
981–982 copies the previous leader's start_time and start_boottime while
de-threading. Around995 it exchanges task IDs and transfers TGID/PGID/SID
identity. At1725, the EXEC event carries old_vpid.

Do not treat an unchanged numeric PID or fixed start-tick assumption as a
complete task/image lineage. Typed birth/process/image references, explicit
former-TID mapping, stopped facts and real multithread-exec tests must establish
the actual transition. This does not authorize invented terminal waits for
retired sibling tasks.

## Exit stops are not terminal drain

[kernel/exit.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/kernel/exit.c)
904 emits the EXIT ptrace event before io_uring_files_cancel, exit_signals and
thread-group live-count processing. An EXIT stop is not a final reaped wait,
stream completion, daemon operation completion or absent database backend.

## Related lifetime boundary

SO_PEERPIDFD is derived from the socket's stored peer identity, not a fresh
numeric PID lookup. In v6.17, AF_UNIX uses PIDFD_STALE in
[net/core/sock.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/net/core/sock.c).
[kernel/fork.c](https://raw.githubusercontent.com/torvalds/linux/v6.17/kernel/fork.c)
1816 onward bypasses reaped-task linkage checks under that flag, so an already
dead peer can produce a readable held pidfd. The reviewed lifetime contract's
poll→fdinfo→poll sequence and exit precedence still require actual kernel tests.

Neither peer credentials nor a held peer pidfd identifies the writer of each
later byte after descriptor inheritance/delegation. A complete accepted-socket,
owned-history and closed descriptor-transfer/writer boundary remains required
before forwarding. No source note here supplies that missing authority.
