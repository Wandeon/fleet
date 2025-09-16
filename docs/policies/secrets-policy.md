# Secrets Policy (SOPS)

- All secrets reside under `secrets/` or `roles/<role>/.env.sops.enc`.
- Only encrypted files are committed.
- AGE recipients per role:
  - `hdmi-media`: `age1g4m2qmksughaqut99phyrn7y62kyxnydqfx3kcdyq5rq6c40yfhsd5lcr2`
  - `camera`: `age1klezevqpsvcnnk5esnlfs40e04erer52mrskwrh8m2hlchrzvcyq33rxz2`
- AGE keys are rotated quarterly.
- Plaintext secrets in Git are prohibited.
- The private key `/etc/fleet/age.key` is distributed via a secure offline channel
  and must be owned by root with `600` permissions.
- Hosts require a functional `sops` binary. The `cloud-init` configuration
  installs the appropriate release for ARM devices to ensure decryption works.
- Operators can inspect a role secret with `sops --decrypt --input-type dotenv roles/<role>/.env.sops.enc`
  once their `AGE` identity is installed.
