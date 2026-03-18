# file-type-validation — requirements

### Requirement: --file accepts .html and .htm only
The CLI SHALL validate the extension of the `--file` argument before calling `render()`. If the extension is not `.html` or `.htm` (case-insensitive), the CLI SHALL format and print an `INVALID_FILE_TYPE` error to stderr and exit with code 1. File existence is checked first — if the file does not exist, `FILE_NOT_FOUND` is emitted instead.

#### Scenario: .html extension accepted
- **WHEN** `pixdom convert --file page.html` is run and the file exists
- **THEN** validation passes and rendering proceeds

#### Scenario: .htm extension accepted
- **WHEN** `pixdom convert --file page.htm` is run and the file exists
- **THEN** validation passes and rendering proceeds

#### Scenario: Unsupported extension rejected
- **WHEN** `pixdom convert --file report.pdf` is run
- **THEN** stderr contains an `INVALID_FILE_TYPE` error naming `report.pdf` and the process exits with code 1

#### Scenario: Missing file reported before type check
- **WHEN** `pixdom convert --file missing.pdf` is run and the file does not exist
- **THEN** stderr contains a `FILE_NOT_FOUND` error (not `INVALID_FILE_TYPE`) and the process exits with code 1

### Requirement: --image accepts .png, .jpg, .jpeg, .webp, .gif only
The CLI SHALL validate the extension of the `--image` argument before calling `render()`. If the extension is not one of `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` (case-insensitive), the CLI SHALL format and print an `INVALID_FILE_TYPE` error to stderr and exit with code 1. File existence is checked first.

#### Scenario: .png extension accepted
- **WHEN** `pixdom convert --image photo.png` is run and the file exists
- **THEN** validation passes and rendering proceeds

#### Scenario: Unsupported image extension rejected
- **WHEN** `pixdom convert --image document.pdf` is run
- **THEN** stderr contains an `INVALID_FILE_TYPE` error naming `document.pdf` and the process exits with code 1

#### Scenario: Missing image reported before type check
- **WHEN** `pixdom convert --image missing.png` is run and the file does not exist
- **THEN** stderr contains an `IMAGE_NOT_FOUND` error and the process exits with code 1

### Requirement: MIME sniff fallback for extension-ambiguous inputs
When the `--file` or `--image` argument has no extension or an unrecognised extension (not in either allowed list), the CLI SHALL read the first 16 bytes of the file and apply byte-pattern sniffing to determine MIME type. If the sniffed type is allowed for the flag in use, validation passes. If the sniff is inconclusive or the type is not allowed, `INVALID_FILE_TYPE` is emitted.

#### Scenario: Extension-less HTML file accepted via sniff
- **WHEN** `pixdom convert --file page` is run, the file exists, and its first bytes contain `<!DOCTYPE html`
- **THEN** validation passes and rendering proceeds

#### Scenario: Extension-less binary file rejected via sniff
- **WHEN** `pixdom convert --file data` is run, the file exists, and its first bytes are not an HTML signature
- **THEN** stderr contains an `INVALID_FILE_TYPE` error and the process exits with code 1
