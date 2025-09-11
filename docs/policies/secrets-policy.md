# Secrets Policy (SOPS)

- All secrets reside under `secrets/` or `roles/<role>/.env.sops.enc`.
- Only encrypted files are committed.
- AGE keys are rotated quarterly.
- Plaintext secrets in Git are prohibited.
