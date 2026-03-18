import type { Command } from 'commander';
/**
 * Registers omelette-based shell completion and the `pixdom completion` subcommand.
 *
 * Must be called BEFORE program.parse() so that omelette can intercept completion
 * requests (--compgen, --completion, --completion-fish) before Commander processes argv.
 */
export declare function registerCompletion(program: Command): void;
//# sourceMappingURL=completion.d.ts.map