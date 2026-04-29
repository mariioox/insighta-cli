# Insighta Labs+ CLI Tool

The command-line interface for the Insighta Labs+ Profile Intelligence System. Part of **Stage 3 - Secure Access & Multi-Interface Integration**.

## Features
- **Secure Authentication**: Uses GitHub OAuth with PKCE flow.
- **Profile Management**: List and search profiles with filtering.
- **Admin Tools**: Export profile data to CSV (Restricted to Admin role).
- **Local Credential Storage**: Securely stores tokens in `~/.insighta/credentials.json`.

## Installation

To install this CLI globally on your system:
```bash
git clone https://github.com/mariioox/insighta-cli.git
npm install
npm link
