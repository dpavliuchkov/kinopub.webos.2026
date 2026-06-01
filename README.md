# Kinopub for webOS

A [Kinopub](https://kinopub.me) client for LG Smart TVs running webOS, built with [Enact](https://enactjs.com) and Moonstone.

---

## Table of Contents

- [Requirements](#requirements)
- [Building from Source](#building-from-source)
- [TV Setup Guide](#tv-setup-guide)
- [Troubleshooting](#troubleshooting)
- [Screenshots](#screenshots)

---

## Requirements

| Requirement       | Details                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| LG Smart TV       | webOS v3 or later                                                                   |
| Node.js           | **v14 (LTS Fermium)** — v15+ breaks the build due to OpenSSL incompatibility        |
| Package manager   | Yarn                                                                                |
| webOS CLI         | `@webosose/ares-cli` (included as a dev dependency)                                 |
| Key exchange tool | `ares-novacom` (must be available globally — see [TV Setup Guide](#tv-setup-guide)) |

---

## Building from Source

### 1. Use Node.js 14

Node.js 14 is required. Newer versions fail during the build with an OpenSSL error (`ERR_OSSL_EVP_UNSUPPORTED`).

```bash
nvm install lts/fermium
nvm use lts/fermium
node --version  # v14.x.x
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Build and package

```bash
yarn build && yarn package
```

The packaged `.ipk` files are written to the `out/` directory. The main app file is `kinopub.webos_v<VERSION>.ipk`.

### 4. Install on TV

```bash
npx ares-install --device <DEVICE_NAME> out/kinopub.webos_v*.ipk
```

---

## TV Setup Guide

Follow these steps once to prepare your LG TV for sideloading apps.

### Step 1 — Create an LG Developer account

Register at [webostv.developer.lge.com](https://webostv.developer.lge.com). A free account is sufficient.

### Step 2 — Install the Developer Mode app

1. On the TV, open the **LG Content Store**
2. Search for **Developer Mode** and install it
3. Launch the app and sign in with your LG Developer account
4. Toggle **Dev Mode Status** to **ON**

The TV will reboot. After reboot, Developer Mode is active.

> **Note:** Developer Mode automatically turns off after 50 hours or after 10 reboots without a network connection. Open the Developer Mode app and tap **Extend** to reset the timer.

### Step 3 — Register your TV with ares-cli

Find your TV's IP address under **Settings → Network → Wi-Fi Connection → Advanced**, then run:

```bash
npx ares-setup-device -a <DEVICE_NAME> \
  -i "host=<TV_IP>" \
  -i "port=9922" \
  -i "username=prisoner"
```

Replace `<DEVICE_NAME>` with any name you choose (e.g. `lgtv`) and `<TV_IP>` with your TV's IP address.

### Step 4 — Exchange SSH keys

1. In the Developer Mode app, press the **Key Server** button
2. A 6-character passphrase appears in the bottom-left corner of the screen (case-sensitive)
3. On your computer, run:

```bash
ares-novacom --device <DEVICE_NAME> --getkey
```

4. Enter the passphrase when prompted

This generates an SSH key pair and registers the public key with the TV. The private key is saved to `~/.ssh/<DEVICE_NAME>_webos`.

5. Tell ares-cli to use the new key:

```bash
npx ares-setup-device -m <DEVICE_NAME> -i "privatekey=<DEVICE_NAME>_webos"
```

6. Verify the connection:

```bash
npx ares-install --device <DEVICE_NAME> --list
```

An empty list with no error means the connection is working.

### Step 5 — Launch the app

```bash
npx ares-launch --device <DEVICE_NAME> kinopub.webos
```

---

## Troubleshooting

### "no matching host key type found"

Modern OpenSSH disables `ssh-rsa` by default. Add the following to `~/.ssh/config`:

```
Host <TV_IP>
    Port 9922
    HostKeyAlgorithms +ssh-rsa
    PubkeyAcceptedKeyTypes +ssh-rsa
    IdentityFile ~/.ssh/<DEVICE_NAME>_webos
```

### Build fails with OpenSSL error

You are likely running Node.js 15 or later. Switch to Node.js 14:

```bash
nvm use lts/fermium
```

If you see `node: --openssl-legacy-provider is not allowed in NODE_OPTIONS`, unset that variable — it is not needed on Node 14:

```bash
unset NODE_OPTIONS
```

### "All configured authentication methods failed"

The passphrase shown in the Developer Mode app expires quickly. Re-open the app, press **Key Server** again to get a fresh passphrase, and re-run `ares-novacom --getkey`.

---

## Screenshots

See [SCREENSHOTS.md](./SCREENSHOTS.md) for a full preview of the app.
