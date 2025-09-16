# Day 1 Operator Handbook

## Prereqs
- A GitHub account and a new **empty** repo created (e.g., `your-org/fleet`).
- A Tailscale account (generate a **pre-auth key**).
- An `age` keypair for SOPS (see below).

## 1) Create SOPS age key
On your laptop:
```bash
age-keygen -o age.key
cat age.key | grep public
```

Store `age.key` securely. Copy it to the Pi at `/etc/fleet/age.key` during provisioning.

## 2) Generate a Tailscale pre-auth key
From the Tailscale admin panel: create a reusable pre-auth key.

## 3) Initialize this repo and push
```bash
git init
git add .
git commit -m "feat: bootstrap fleet repo"
git branch -M main
git remote add origin https://github.com/<your-org>/fleet.git
git push -u origin main
```

## 4) On the Pi (first boot)
```bash
sudo apt update && sudo apt install -y git curl docker.io docker-compose-plugin tailscale sops
sudo tailscale up --authkey <YOUR-PREAUTH-KEY>
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/<your-org>/fleet.git
sudo cp /opt/fleet/agent/role-agent.service /etc/systemd/system/
sudo cp /opt/fleet/agent/role-agent.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now role-agent.timer
```

## 5) Assign the device a role
Edit `inventory/devices.yaml` on GitHub (replace hostname with your Pi's hostname):
```yaml
devices:
  pi-camera-01:
    role: camera
```

Commit to `main`. Within 2 minutes the Pi will converge to the `camera` role.

## 6) Secrets (SOPS) - example
Create a role env file and encrypt it:
```bash
cat > roles/camera/.env.sops <<'EOF'
CAMERA_EXAMPLE_VAR=hello
EOF

sops --encrypt --age <your-age-public-key> roles/camera/.env.sops > roles/camera/.env.sops.enc
rm roles/camera/.env.sops
git add roles/camera/.env.sops.enc
git commit -m "chore: add encrypted env for camera role"
git push
```
The agent expects `roles/<role>/.env.sops.enc`. It will decrypt to memory using `/etc/fleet/age.key` at runtime.
Use `sops --decrypt --input-type dotenv roles/<role>/.env.sops.enc` to inspect a secret locally once your age identity is installed.
