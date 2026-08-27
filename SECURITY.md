# Security Policy

## Supported Versions

Security fixes are handled on the current main branch and the latest published
release candidate. Older builds should be upgraded before reporting runtime
issues unless the vulnerability is also reproducible on the current branch.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability that exposes tokens,
printer access, local files, tunnel configuration, or remote execution risk.

Use GitHub private vulnerability reporting when it is enabled for the
repository. If private reporting is not available, contact the repository owner
through their GitHub profile and share only the minimum detail needed to arrange
a private disclosure path.

Helpful reports include:

- affected version or commit,
- operating system and installer type,
- whether ngrok or another remote tunnel is enabled,
- exact endpoint or UI flow involved,
- reproduction steps,
- expected impact,
- any relevant logs with tokens and local secrets redacted.

## Security Model

Print Agent is designed to run on a trusted Windows workstation with access to
local printers and, optionally, a remote tunnel. Treat the API token and ngrok
authtoken as secrets.

- All HTTP API endpoints require a Print Agent API token.
- The Print Agent API token is stored locally as a hash.
- The ngrok authtoken is stored locally using Electron safe storage when
  available.
- Remote access URLs can be public, but they should not be useful without the
  API token.
- Do not bake store-specific tokens, tunnel URLs, or printer configuration into
  installers or source control.

## Scope

In scope:

- token authentication bypasses,
- accidental token or tunnel secret exposure,
- unsafe installer or uninstaller behavior,
- remote tunnel behavior that exposes local printer operations,
- print-job validation issues that can crash or hang the agent.

Out of scope:

- vulnerabilities in third-party printer drivers,
- vulnerabilities in externally installed tools such as SumatraPDF, IrfanView,
  ngrok, or Windows Package Manager,
- physical attacks on the Windows workstation,
- denial of service from a user who already has local administrator access.
