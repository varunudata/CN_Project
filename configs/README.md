# Configuration Bundle Index

This directory contains documented, secret-free configuration files for both Phase 1 and Phase 2 of the **Private Network Service Platform**.

| File | Role / Phase | Target Machine | Description |
| --- | --- | --- | --- |
| [dnsmasq/primary-dnsmasq.conf](dnsmasq/primary-dnsmasq.conf) | Primary DNS (Phase 1 & 2) | Primary Mac (`10.109.112.94`) | Authoritative local resolver for `app.team1.test` and `api.team1.test` (`local-ttl=30`), showing both pre-cutover and post-cutover edge targets. |
| [dnsmasq/backup-dnsmasq.conf](dnsmasq/backup-dnsmasq.conf) | Backup DNS (Phase 2) | Secondary Mac (`10.109.112.62`) | Clean copy of the active `/opt/homebrew/etc/dnsmasq.conf` providing DNS failover when Primary DNS stops. |
| [dnsmasq/dnsmasq.conf](dnsmasq/dnsmasq.conf) | Historical Phase 1 Artifact | Primary Mac (Phase 1) | Original Phase 1 failure-demo artifact (`10.29.242.250` unreachable IP test). Preserved for historical reference. |
| [nginx/primary-nginx.conf](nginx/primary-nginx.conf) | Primary Edge Proxy (Phase 1 & 2) | Primary Mac (`10.109.112.94`) | HTTPS edge proxy with TLS 1.2/1.3, HTTP/2, round-robin load balancing, passive health checks, and port 80 -> 443 redirect. |
| [nginx/standby-nginx.conf](nginx/standby-nginx.conf) | Standby Edge Proxy (Phase 2) | Secondary Mac (`10.109.112.62`) | Clean copy of the active `~/cn-standby/nginx.conf` proxying over LAN to `10.109.112.94:4000` and `:6000`. |
| [nginx/team1.conf](nginx/team1.conf) | Historical Phase 1 Artifact | Primary Mac (Phase 1) | Original Phase 1 Nginx config referencing the primary author's local path. Preserved for historical reference. |
| [pf/cn_project.anchor.conf](pf/cn_project.anchor.conf) | Service Isolation Firewall (Phase 2) | Primary Mac (`10.109.112.94`) | macOS `pf` anchor rules restricting inbound TCP ports `4000` and `6000` to loopback and `10.109.112.62`. |
| [pf/README.md](pf/README.md) | Firewall Runbook (Phase 2) | Primary Mac (`10.109.112.94`) | Installation, syntax check, activation, verification, and rollback instructions for PF. |

> **Security Policy**: Private TLS keys (`certs/*-key.pem`) are excluded via `.gitignore` and never stored in `configs/`. Configuration files use `<PROJECT_ROOT>` or `<STANDBY_CERTS_DIR>` placeholders where local filesystem paths vary.
