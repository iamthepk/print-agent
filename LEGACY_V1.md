# Legacy Print Agent v1

This branch preserves the sanitized history of the original Print Agent v1.

V1 was the production predecessor of Print Agent v2. It used a Node-based local
server, startup scripts, and an external ngrok process targeting port 8000.

New development and deployments should use the `main` branch of the Print Agent
v2 repository. This branch is kept only for historical context and migration
reference.

Sensitive local runtime files, including `.env`, ngrok URL/log files, and local
build outputs, are intentionally excluded from this legacy branch.
