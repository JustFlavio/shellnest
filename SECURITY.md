# Security policy

Shellnest stores SSH credentials, so security reports are taken seriously.

**Status: alpha, not audited.** The vault uses Argon2id and XChaCha20-Poly1305, but nobody independent has reviewed the code. Do not rely on Shellnest to protect secrets you cannot afford to lose. Sync between devices is experimental.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private reporting: the **Security** tab of this repository, then **Report a vulnerability**.

Include what you found, how to reproduce it, and the version or commit. You will get an answer as soon as the maintainer can, usually within a week. This is a spare-time project, so there is no bounty and no fixed fix deadline.

## Scope

In scope: the desktop app (vault, SSH, terminal) and the sync server in `sync/`.
Out of scope: weaknesses that need the attacker to already control your unlocked machine, and the design limits listed in [the guide](docs/guida.it.md) (for example, a single token for the whole sync service).

Only the latest release is supported.
