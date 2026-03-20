## Requirements

### Requirement: Centralised temp directory registry module
`packages/core/src/temp-registry.ts` SHALL export:
- `registerTempDir(dir: string): void` — adds `dir` to the active set
- `releaseTempDir(dir: string): Promise<void>` — removes `dir` from the active set and deletes it from the filesystem
- `cleanupAll(): Promise<void>` — deletes all currently registered directories and clears the set

At module load time, `temp-registry.ts` SHALL register exactly one `SIGINT` handler and one `SIGTERM` handler using `process.once`. Each handler SHALL call `cleanupAll()` synchronously (best-effort) then exit the process with the conventional signal exit code (`130` for SIGINT, `143` for SIGTERM).

#### Scenario: registerTempDir adds to active set
- **WHEN** `registerTempDir('/tmp/pixdom-abc')` is called
- **THEN** the directory is tracked and `cleanupAll()` will attempt to delete it

#### Scenario: releaseTempDir removes and deletes
- **WHEN** `releaseTempDir('/tmp/pixdom-abc')` is called and the directory exists
- **THEN** the directory is deleted from the filesystem and removed from the active set

#### Scenario: cleanupAll deletes all registered dirs
- **WHEN** three directories are registered and `cleanupAll()` is called
- **THEN** all three directories are deleted and the active set is empty

#### Scenario: Signal handlers registered exactly once at module load
- **WHEN** `temp-registry` is imported multiple times (e.g., by multiple modules in the same process)
- **THEN** `process.listenerCount('SIGINT')` remains 1 after all imports

#### Scenario: SIGINT triggers cleanup and exits with code 130
- **WHEN** a registered temp directory exists and `SIGINT` fires
- **THEN** the directory is deleted and the process exits with code 130

#### Scenario: SIGTERM triggers cleanup and exits with code 143
- **WHEN** a registered temp directory exists and `SIGTERM` fires
- **THEN** the directory is deleted and the process exits with code 143

### Requirement: renderAnimated uses temp registry
The `renderAnimated` function in `packages/core` SHALL replace its inline `process.once('SIGINT'/'SIGTERM')` handlers with calls to `registerTempDir` at temp directory creation time and `releaseTempDir` at cleanup time. No per-render signal handlers SHALL be installed.

#### Scenario: No per-render signal handler installed
- **WHEN** `renderAnimated` is called
- **THEN** `process.listenerCount('SIGINT')` does not increase beyond its value before the call

#### Scenario: Temp dir cleaned up on normal completion
- **WHEN** `renderAnimated` completes successfully
- **THEN** `releaseTempDir` is called and the temp directory no longer exists on disk

#### Scenario: Temp dir cleaned up on render error
- **WHEN** `renderAnimated` throws or returns an error result
- **THEN** `releaseTempDir` is called in the finally block and the temp directory is deleted

#### Scenario: Concurrent renders all cleaned up on signal
- **WHEN** five concurrent `renderAnimated` calls are in progress and `SIGINT` fires
- **THEN** all five temp directories are deleted and the process exits with code 130

### Requirement: MCP server imports temp registry at startup
The MCP server entry point SHALL import `temp-registry` as a side-effect import on startup, before handling any tool calls, to ensure signal handlers are registered before the first render.

#### Scenario: Signal handlers active before first tool call
- **WHEN** the MCP server process starts
- **THEN** `process.listenerCount('SIGINT')` is 1 before any tool call is received
