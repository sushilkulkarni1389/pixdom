export function makeError(code, message, cause, hints) {
    const error = { code, message, cause };
    if (hints !== undefined)
        error.hints = hints;
    return error;
}
