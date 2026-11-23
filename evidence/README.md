# Evidence Index

## Phase 1 Build Evidence

- `phase-1/A-lan-setup/` — interface, IPv4/subnet, gateway, and ping screenshots across machines.
- `phase-1/B-dns/` — client DNS settings, dnsmasq configuration/logs, and `dig` resolution results for `app` and `api`.
- `phase-1/C-backends-and-D-load-balancing/` — backend direct checks, nginx configuration/access logs, and edge proxy responses.
- `phase-1/E-https-or-tls/` — browser certificate trust, green padlock, and verbose TLS handshake output.
- `phase-1/F-caching/` — `Cache-Control`, `ETag`, and conditional `304 Not Modified` responses.
- `phase-1/G-wireshark/` — DNS query/response, TCP three-way handshake, TLS handshake, and encrypted application data.
- `phase-1/failures/` — Section 6.3 deliberate failure scenarios demonstrating layer independence and fault isolation.

---

## Phase 2 Evidence (Two-Mac Hardening, Failover & Cutover)

Organized per host machine (`sadhvik-mac` = Primary Mac `10.109.112.94`, `varun-mac` = Secondary Mac `10.109.112.62`):

### Primary Mac (`phase-2/sadhvik-mac/`) — 12 Screenshots
- `A-lan-setup/` — Primary Mac `en0` IPv4 (`10.109.112.94`), subnet mask, router gateway, and MAC address.
- `B-dns/` — Primary `dnsmasq` UDP/TCP `:53` listener, `dig` resolution, query logs, and cutover resolution to `10.109.112.62`.
- `C-backends-and-D-load-balancing/` — Direct Express checks (`:4000`, `:6000`), `nginx -t` validation, and HTTP `301` redirect responses.
- `E-https-or-tls/` — Verbose TLS 1.3 handshake (`app.team1.test`) and HTTP/2 response from Backend A.
- `H-pf-firewall-isolation/` — `pfctl -s info`, `pfctl -sr`, and active `/etc/pf.anchors/cn_project` rules allowing `10.109.112.62` on ports `4000` & `6000`.
- `I-ha-failover-and-recovery/` — Backend listening on `*:4000` / `*:6000`, stopping both backends (`kill`), and restarting both backends.

### Secondary Mac (`phase-2/varun-mac/`) — 24 Screenshots
- `A-lan-setup/` — Secondary Mac `en0` IPv4 (`10.109.112.62`), subnet mask, gateway, and MAC address.
- `B-dns-and-backup-dns/` — Backup `dnsmasq` `:53` listener, client DNS resolver order (`10.109.112.94`, `10.109.112.62`), primary vs. backup `dig` verification, cutover restart, and backup failover resolution.
- `C-backends-and-D-load-balancing/` — 10 consecutive HTTPS requests alternating evenly across `X-Backend: B` and `X-Backend: A`.
- `E-https-or-tls/` — HTTP `301` redirect and verbose TLS 1.3 / HTTP/2 handshake verification.
- `F-caching/` — `/api/cached` returning `Cache-Control: public, max-age=60`, `ETag: "v1"`, and conditional `304 Not Modified`.
- `G-wireshark/` — Live `en0` packet captures of DNS (`53/UDP`), TLS ClientHello/ServerHello (`SNI=app.team1.test`), TCP `443` ACK/encrypted data, Seq/Ack/`FIN, ACK`, and TCP Fast Retransmission.
- `I-ha-failover-and-standby-nginx/` — Backend A stopped (100% Backend B), Backend A restarted (8/8 alternating), Backend B stopped (100% Backend A), both backends stopped (`HTTP/2 502 Bad Gateway`), backend recovery (`200`), and active Standby Nginx HTTPS + load balancing verification.

---

## Diagnostics & Historical Captures

- `diagnostics/` — captures demonstrating DNS misconfiguration troubleshooting and record recovery.
- Files named `historical-*` in `phase-1/C-backends-and-D-load-balancing/` predate the current round-robin setup.

---

## Deliverables & Status Summary

| Area | Current Evidence Status | Notes |
| --- | --- | --- |
| **Phase 1 (Tasks A–G)** | Complete | LAN, DNS, Backends/LB, TLS, Caching, and Wireshark captures verified |
| **Phase 2 (Extensions A, C, D, E)** | Complete | 36 screenshots organized across `sadhvik-mac/` (12) and `varun-mac/` (24) |
| **Phase 2 Pending Optional Items** | 2 items uncaptured | Timed 30s DNS TTL cache-flush demo and third-host PF block drop test remain `NOT VERIFIED` |
