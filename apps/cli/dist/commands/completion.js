import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
// omelette is a CJS module with no @types package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const omelette = _require('omelette');
// Profile slugs per cli-autocomplete spec: 19 canonical + 3 legacy aliases.
// Reference: platform-profiles spec for canonical slug definitions.
const PROFILE_SLUGS = [
    // LinkedIn
    'linkedin-background',
    'linkedin-post',
    'linkedin-article-cover',
    'linkedin-profile',
    'linkedin-single-image-ad',
    'linkedin-career-background',
    // Twitter/X
    'twitter-post',
    'twitter-header',
    'twitter-ad',
    'twitter-video',
    'twitter-ad-landscape',
    // Instagram
    'instagram-post-3-4',
    'instagram-post-4-5',
    'instagram-post-square',
    'instagram-story',
    'instagram-reel',
    'instagram-profile',
    'instagram-story-video',
    // Generic
    'square',
    // Legacy aliases — resolved server-side to canonical slugs
    'linkedin',
    'twitter',
    'instagram',
];
const FORMAT_VALUES = ['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm'];
const CONVERT_FLAGS = [
    '--html',
    '--file',
    '--url',
    '--image',
    '--profile',
    '--output',
    '--format',
    '--width',
    '--height',
    '--quality',
    '--fps',
    '--duration',
    '--auto-size',
];
/**
 * Generates a correct bash/zsh/fish completion init script.
 *
 * omelette's generateCompletionCode() wraps the bash -W wordlist in single quotes,
 * preventing the $(pixdom --compbash ...) command substitution from ever executing.
 * This function emits the same structure with the bash block fixed to use a local
 * variable so the substitution runs correctly.
 */
function generateCompletionScript(program) {
    const fn = `_${program}_completion`;
    return [
        `### ${program} completion - begin ###`,
        `if type compdef &>/dev/null; then`,
        `  ${fn}() {`,
        `    compadd -- \`${program} --compzsh --compgen "\${CURRENT}" "\${words[CURRENT-1]}" "\${BUFFER}"\``,
        `  }`,
        `  compdef ${fn} ${program}`,
        `elif type complete &>/dev/null; then`,
        `  ${fn}() {`,
        `    local cur prev nb_colon _${program}_comps`,
        `    _get_comp_words_by_ref -n : cur prev`,
        `    nb_colon=$(grep -o ":" <<< "$COMP_LINE" | wc -l)`,
        `    _${program}_comps=$(${program} --compbash --compgen "$((COMP_CWORD - (nb_colon * 2)))" "$prev" "\${COMP_LINE}")`,
        `    COMPREPLY=( $(compgen -W "$_${program}_comps" -- "$cur") )`,
        `    __ltrim_colon_completions "$cur"`,
        `  }`,
        `  complete -F ${fn} ${program}`,
        `fi`,
        `### ${program} completion - end ###`,
    ].join('\n');
}
/**
 * Registers omelette-based shell completion and the `pixdom completion` subcommand.
 *
 * Must be called BEFORE program.parse() so that omelette can intercept completion
 * requests (--compgen, --completion, --completion-fish) before Commander processes argv.
 */
export function registerCompletion(program) {
    // Instantiating omelette calls checkInstall() internally: if --completion or
    // --completion-fish is in argv, it outputs the shell init script and exits immediately.
    const completion = omelette('pixdom <command>');
    completion.tree({
        convert: Object.fromEntries([
            ...CONVERT_FLAGS.filter((f) => f !== '--profile' && f !== '--format').map((f) => [f, []]),
            ['--profile', PROFILE_SLUGS],
            ['--format', FORMAT_VALUES],
        ]),
        completion: ['--install'],
    });
    // Intercepts --compgen N <word> <line...> injected by the shell during TAB expansion.
    // Outputs completions and exits; no-op in normal execution.
    // try/catch: omelette's tree traversal crashes when flag values appear alongside --file/--image
    // (reduce() walks the tree with flag names as keys; a bare value hits undefined and throws).
    // Swallowing the error lets bash fall through to native filename completion.
    try {
        completion.init();
    }
    catch {
        // ignore — bash uses default completion
    }
    program
        .command('completion')
        .description('Print shell completion script to stdout')
        .option('--install', 'Print installation instructions for your shell')
        .action((opts) => {
        if (opts.install) {
            process.stdout.write([
                'pixdom shell completion setup',
                '',
                'Bash — add to ~/.bashrc:',
                "  echo '. <(pixdom --completion)' >> ~/.bashrc",
                '  source ~/.bashrc',
                '',
                'Zsh — add to ~/.zshrc:',
                "  echo '. <(pixdom --completion)' >> ~/.zshrc",
                '  source ~/.zshrc',
                '',
                'Fish — write to completions directory:',
                '  pixdom --completion-fish > ~/.config/fish/completions/pixdom.fish',
                '',
            ].join('\n'));
            process.exit(0);
        }
        else {
            process.stdout.write(generateCompletionScript('pixdom') + '\n');
            process.exit(0);
        }
    });
}
