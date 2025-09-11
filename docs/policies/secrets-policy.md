# Secrets Policy (SOPS)

- All secrets reside under `secrets/` or `roles/<role>/.env.sops.enc`.
- Only encrypted files are committed.
- AGE keys are rotated quarterly.
- Plaintext secrets in Git are prohibited.
- The private key `/etc/fleet/age.key` is distributed via a secure offline channel
  and must be owned by root with `600` permissions.
- Hosts require a functional `sops` binary. The `cloud-init` configuration
  installs the appropriate release for ARM devices to ensure decryption works.
