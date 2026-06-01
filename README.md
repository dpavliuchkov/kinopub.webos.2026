# Kinopub WebOS

A Kinopub client for LG Smart TVs with WebOS - using EnactJS, Moonstone

## Requirements

- LG Smart TV with WebOS v3+
- Node.js **v14** (LTS Fermium) — newer versions break the build
- `ares-cli` (included as a dev dependency via `@webosose/ares-cli`)
- `ares-novacom` installed globally (required for TV key exchange — see below)

or

- Smart TV with Media Station X

## Installation (pre-built IPK)

- Download [latest ipk file](https://github.com/adascal/kinopub.webos/releases/latest)
- `$ ares-install --device $DEVICE_NAME $PATH_TO_IPK_FILE`

[Следуйте этой инструкции](https://bit.ly/3s4YoYg) чтобы установить через Media Station X

## Building from source

### 1. Use Node.js 14

This project requires Node.js 14. Using a newer version will fail with OpenSSL errors.

```bash
nvm install lts/fermium
nvm use lts/fermium
node --version  # should print v14.x.x
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Build and package

```bash
yarn build && yarn package
```

This produces `.ipk` files in the `out/` directory.

## Setting up your LG TV for development

### Step 1 — Create an LG Developer account

Sign up at [webostv.developer.lge.com](https://webostv.developer.lge.com).

### Step 2 — Install the Developer Mode app on your TV

1. Open **LG Content Store** on the TV
2. Search for **"Developer Mode"** and install it
3. Launch the app and sign in with your LG Developer account
4. Toggle **Dev Mode Status** to ON — the TV will reboot

> Developer Mode auto-disables after 50 hours or 10 reboots without network. Use the **Extend** button in the app to renew it.

### Step 3 — Add your TV as a device

```bash
npx ares-setup-device -a mytv \
  -i "host=<TV_IP>" \
  -i "port=9922" \
  -i "username=prisoner"
```

Replace `<TV_IP>` with your TV's IP address (Settings → Network → Wi-Fi Connection → Advanced).

### Step 4 — Exchange SSH keys

In the Developer Mode app on the TV, press the **Key Server** button. A 6-character passphrase will appear in the bottom-left of the screen.

Then run:

```bash
ares-novacom --device mytv --getkey
```

Enter the passphrase when prompted (case-sensitive). This stores the SSH private key at `~/.ssh/mytv_webos`.

Register the key with the device:

```bash
npx ares-setup-device -m mytv -i "privatekey=mytv_webos"
```

Verify the connection:

```bash
npx ares-install --device mytv --list
```

> **Troubleshooting SSH:** If you get "no matching host key type found", your OpenSSH client disables `ssh-rsa` by default. Add this to `~/.ssh/config`:
>
> ```
> Host <TV_IP>
>     Port 9922
>     HostKeyAlgorithms +ssh-rsa
>     PubkeyAcceptedKeyTypes +ssh-rsa
>     IdentityFile ~/.ssh/mytv_webos
> ```

### Step 5 — Install on TV

```bash
npx ares-install --device mytv out/kinopub.webos_v*.ipk
```

### Step 6 — Launch

```bash
npx ares-launch --device mytv kinopub.webos
```

## Screenshots

Checkout [screenshots here](./SCREENSHOTS.md)
