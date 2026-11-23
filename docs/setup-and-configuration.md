# Setup and Configuration Guide

This runbook documents the complete installation, configuration, startup, verification, and troubleshooting procedures for the two-Mac **Private Network Service Platform** (Phase 1 + Phase 2).

> **Note on Paths**: References such as `<PROJECT_ROOT>` represent the repository directory on each Mac (e.g., `~/Desktop/CN_Project` on the Primary Mac). Never commit private keys (`certs/*-key.pem`) to Git.

---

## 1. Prerequisites and Host Assignment

- **Hardware**: Two macOS laptops with administrator (`sudo`) privileges connected to the same private Wi-Fi LAN/hotspot.
- **IP Addresses (Current Verified Session)**:
  - **Primary Mac**: `10.109.112.94` — runs Primary `dnsmasq`, Primary `nginx`, Backend A (`4000`), Backend B (`6000`), and PF firewall.
  - **Secondary Mac (Varun's Mac)**: `10.109.112.62` — runs Backup `dnsmasq`, Standby `nginx`, and serves as the test client.
- **Domain Names**: `app.team1.test` and `api.team1.test` (using `.test` to avoid macOS `.local` mDNS conflicts).

---

## 2. Software Dependencies and Installation

Install the required tools on both Macs via Homebrew:

```sh
# Install Node.js, dnsmasq, and nginx
brew install node dnsmasq nginx

# Optional (for packet capture analysis)
brew install --cask wireshark
```

Verify installed versions:

```sh
node -v
npm -v
nginx -v
dnsmasq -v
openssl version
```

---

## 3. Express.js Backend Startup (Primary Mac: `10.109.112.94`)

Both backends reside in [backendA/](../backendA/server.js) and [backendB/](../backendB/server.js) using Express `^5.2.1`.

### Install Dependencies

```sh
cd backendA && npm install
cd ../backendB && npm install
```

### Listening Address Note (Phase 1 vs. Phase 2)

- In the committed repository source ([backendA/server.js](../backendA/server.js) and [backendB/server.js](../backendB/server.js)), `app.listen(port, '127.0.0.1', ...)` binds to loopback only (Phase 1).
- For **Phase 2 Standby Nginx** on `10.109.112.62` to reach `10.109.112.94:4000` and `10.109.112.94:6000` over the LAN, the running backend processes on the Primary Mac bind to **`0.0.0.0`** (all interfaces), protected by the PF firewall.
  > **TODO / Code Sync Note**: The committed `server.js` files still show `'127.0.0.1'`. When running Phase 2 cross-Mac standby failover, ensure the Primary Mac's running backend instances bind to `'0.0.0.0'`.

### Start Commands

Open two terminals on the Primary Mac:

```sh
# Terminal 1 — Backend A (port 4000)
cd backendA && npm start

# Terminal 2 — Backend B (port 6000)
cd backendB && npm start
```

---

## 4. Primary `dnsmasq` Configuration (Primary Mac: `10.109.112.94`)

Clean template: [configs/dnsmasq/primary-dnsmasq.conf](../configs/dnsmasq/primary-dnsmasq.conf)

Copy to Homebrew's dnsmasq config path (`/opt/homebrew/etc/dnsmasq.conf` on Apple Silicon, `/usr/local/etc/dnsmasq.conf` on Intel):

```sh
listen-address=127.0.0.1,10.109.112.94
bind-interfaces
port=53

no-resolv
server=8.8.8.8
server=1.1.1.1

# Phase 2 cutover target (Standby Nginx on Secondary Mac)
# For primary edge routing, set these to 10.109.112.94
host-record=app.team1.test,10.109.112.62
host-record=api.team1.test,10.109.112.62

local-ttl=30

log-queries
log-facility=/tmp/dnsmasq.log
```

Start Primary `dnsmasq` (requires `sudo` for port `53`):

```sh
sudo brew services start dnsmasq
```

---

## 5. Backup `dnsmasq` Configuration (Secondary Mac: `10.109.112.62`)

Clean template: [configs/dnsmasq/backup-dnsmasq.conf](../configs/dnsmasq/backup-dnsmasq.conf)

Verified active configuration at `/opt/homebrew/etc/dnsmasq.conf` on the Secondary Mac:

```ini
listen-address=127.0.0.1,10.109.112.62
bind-interfaces
port=53
no-resolv
server=8.8.8.8
server=1.1.1.1
host-record=app.team1.test,10.109.112.62
host-record=api.team1.test,10.109.112.62
local-ttl=30
log-queries
log-facility=/tmp/dnsmasq-backup.log
```

Start Backup `dnsmasq`:

```sh
sudo brew services start dnsmasq
```

### Client DNS Resolver Order

On client Macs (**System Settings -> Network -> Wi-Fi -> Details -> DNS**), configure resolvers in priority order:

1. `10.109.112.94` (Primary DNS)
2. `10.109.112.62` (Backup DNS)

---

## 6. Primary Nginx Configuration (Primary Mac: `10.109.112.94`)

Clean template: [configs/nginx/primary-nginx.conf](../configs/nginx/primary-nginx.conf)

Key blocks from the Primary Nginx configuration (derived from [configs/nginx/team1.conf](../configs/nginx/team1.conf)):

- **Upstream Pool**: `127.0.0.1:4000` and `127.0.0.1:6000` with `max_fails=2 fail_timeout=10s` and `keepalive 16`.
- **Port 80 Listener**: `return 301 https://$host$request_uri;`.
- **Port 443 SSL Listener**: `http2 on;`, `ssl_protocols TLSv1.2 TLSv1.3;`, pointing to `<PROJECT_ROOT>/certs/app.pem` and `<PROJECT_ROOT>/certs/app-key.pem`.
- **Failover Directives**: `proxy_next_upstream error timeout http_502 http_503;` and `proxy_connect_timeout 2s;`.

Validate and start Primary Nginx:

```sh
sudo nginx -t -c <PROJECT_ROOT>/configs/nginx/primary-nginx.conf
sudo nginx -c <PROJECT_ROOT>/configs/nginx/primary-nginx.conf
```

---

## 7. Standby Nginx Configuration (Secondary Mac: `10.109.112.62`)

Clean template: [configs/nginx/standby-nginx.conf](../configs/nginx/standby-nginx.conf)

Verified active configuration deployed at `~/cn-standby/nginx.conf` on the Secondary Mac:

```nginx
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    upstream backends {
        server 10.109.112.94:4000;
        server 10.109.112.94:6000;
    }

    server {
        listen 80;
        server_name app.team1.test api.team1.test;

        location / {
            proxy_pass http://backends;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    server {
        listen 443 ssl;
        http2 on;
        server_name app.team1.test api.team1.test;

        ssl_certificate /Users/<username>/cn-standby/app.pem;
        ssl_certificate_key /Users/<username>/cn-standby/app-key.pem;

        location / {
            proxy_pass http://backends;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

> **Note**: Unlike Primary Nginx, the active Standby Nginx config proxies port 80 directly and omits `max_fails` / `proxy_next_upstream` directives. Optional commented directives are provided in [configs/nginx/standby-nginx.conf](../configs/nginx/standby-nginx.conf) if parity with Primary Nginx is desired.

Validate and start Standby Nginx (use `sudo` if binding ports 80/443 requires root on the host):

```sh
nginx -t -c ~/cn-standby/nginx.conf
nginx -c ~/cn-standby/nginx.conf
```

---

## 8. TLS Certificate Setup and Trust Instructions

### Existing Certificate Inventory

- **Root CA Certificate**: [certs/rootCA.pem](../certs/rootCA.pem) (`CN=CN_Project Local Root CA`, valid until `2036-10-01`).
- **Server Certificate**: [certs/app.pem](../certs/app.pem) (`CN=app.team1.test`, SANs: `DNS:app.team1.test`, `DNS:api.team1.test`, valid until `2027-10-04`).
- **Server Private Key**: `app-key.pem` — **excluded from Git** via `.gitignore`. Transfer out-of-band (e.g., AirDrop or `scp`) to each Nginx edge host (`certs/app-key.pem` on Primary Mac, `~/cn-standby/app-key.pem` on Secondary Mac) with `chmod 600`.

### Trusting the Root CA on Client Macs

Run on every client Mac so browsers and `curl` trust `https://app.team1.test` without `-k`:

```sh
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  certs/rootCA.pem
```

Verify trust and certificate metadata:

```sh
openssl x509 -in certs/app.pem -noout -subject -issuer -dates
```

---

## 9. PF Firewall Configuration (Primary Mac: `10.109.112.94`)

Full instructions and rollback steps are documented in [configs/pf/README.md](../configs/pf/README.md), using rules from [configs/pf/cn_project.anchor.conf](../configs/pf/cn_project.anchor.conf):

```pf
pass in quick on lo0 proto tcp from any to any port { 4000, 6000 } keep state
pass in quick proto tcp from 10.109.112.62 to any port { 4000, 6000 } keep state
block in quick proto tcp from any to any port { 4000, 6000 }
```

Quick load and verify on the Primary Mac:

```sh
sudo cp /etc/pf.conf /etc/pf.conf.backup
sudo cp configs/pf/cn_project.anchor.conf /etc/pf.anchors/cn_project
# Add anchor "cn_project" and load anchor "cn_project" from "/etc/pf.anchors/cn_project" to /etc/pf.conf
sudo pfctl -vnf /etc/pf.conf
sudo pfctl -ef /etc/pf.conf
sudo pfctl -a cn_project -sr
```

---

## 10. Verification Commands

Run these checks from the client/Secondary Mac (`10.109.112.62`):

```sh
# 1. Verify LAN reachability
ping -c 3 10.109.112.94

# 2. Verify DNS resolution against Primary and Backup dnsmasq
dig @10.109.112.94 app.team1.test
dig @10.109.112.62 app.team1.test
dig @10.109.112.62 api.team1.test

# 3. Verify HTTPS and trusted certificate chain (NO -k flag)
curl -i https://app.team1.test/api/data

# 4. Verify Round-Robin Load Balancing across Backend A and Backend B (8 requests)
for i in {1..8}; do
  curl -sI https://app.team1.test/api/data | grep -i x-backend
done

# 5. Verify HTTP Caching (Cache-Control + ETag + 304 Not Modified)
curl -i https://app.team1.test/api/cached
curl -i -H 'If-None-Match: "v1"' https://app.team1.test/api/cached

# 6. Verify permitted Secondary Mac connectivity to protected backend ports
nc -zv 10.109.112.94 4000
nc -zv 10.109.112.94 6000
```

---

## 11. Shutdown, Reload, and Restart Instructions

### Nginx (Primary or Standby)

```sh
# Reload config without dropping connections
sudo nginx -s reload -c <NGINX_CONF_PATH>

# Graceful stop
sudo nginx -s stop -c <NGINX_CONF_PATH>
```

### dnsmasq

```sh
sudo brew services restart dnsmasq
sudo brew services stop dnsmasq
sudo brew services start dnsmasq
```

### macOS DNS Client Cache Flush

```sh
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### PF Firewall Rollback

```sh
sudo cp /etc/pf.conf.backup /etc/pf.conf
sudo pfctl -F all -f /etc/pf.conf
```

---

## 12. Layer-by-Layer Troubleshooting Guide

Diagnose faults systematically from lower layers upward:

| Step | Layer | Command | Common Failure & Fix |
| --- | --- | --- | --- |
| **1** | **L3 Network** | `ipconfig getifaddr en0` / `ping 10.109.112.94` | Machines on different Wi-Fi networks or stale IPs -> reconnect to same LAN and update configs. |
| **2** | **L7 DNS** | `dig @10.109.112.94 app.team1.test` & `scutil --dns` | `NXDOMAIN` or wrong IP -> check `host-record` in `dnsmasq.conf` and verify `dnsmasq` is running on UDP 53. |
| **3** | **L4 TCP / PF** | `nc -zv <EDGE_IP> 443` / `nc -zv 10.109.112.94 4000` | Connection refused or timeout -> check `nginx` listener or verify PF anchor allows `10.109.112.62`. |
| **4** | **L6 TLS** | `curl -v https://app.team1.test/` | Certificate untrusted -> ensure `certs/rootCA.pem` is trusted in `/Library/Keychains/System.keychain`. |
| **5** | **L7 HTTP / Upstream** | `curl -i https://app.team1.test/api/status` | `502 Bad Gateway` -> Nginx is healthy, but Backend A & B are stopped or unreachable on `4000`/`6000`. |
