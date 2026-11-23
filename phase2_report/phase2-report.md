# Phase 2 Engineering Report — Harden, Recover, and Troubleshoot

**Project**: Private Network Service Platform  
**Primary Mac**: `10.109.112.94` (Primary DNS, Primary Nginx, PF Firewall, Express Backend A & Backend B)  
**Secondary Mac (Varun's Mac)**: `10.109.112.62` (Backup DNS, Standby Nginx, Test Client)  
**Private Domains**: `app.team1.test`, `api.team1.test`

---

## 1. Introduction

Phase 1 established the core single-edge service architecture: private DNS resolution via `dnsmasq`, HTTPS/TLS termination at Nginx, round-robin load balancing across two Express.js backends, HTTP caching (`Cache-Control` and `ETag`/`304`), and Wireshark packet analysis. However, Phase 1 left single points of failure at the Primary Mac's DNS server and Nginx reverse proxy.

Phase 2 (**Harden & Recover**) extends the working Phase 1 infrastructure across two Macs without rebuilding from scratch, adding DNS redundancy, controlled TTL configuration, host firewall isolation for backend ports, backend high-availability failover testing, and DNS-cutover migration to a Standby Nginx edge proxy.

---

## 2. Phase 2 Objectives

1. **DNS Redundancy (Extension A)**: Deploy a backup `dnsmasq` resolver on the Secondary Mac (`10.109.112.62`) and verify seamless name resolution when the primary resolver stops.
2. **Short DNS TTL (Extension B)**: Configure a 30-second TTL (`local-ttl=30`) on private DNS records to bound caching windows during service cutover.
3. **Service Isolation (Extension C)**: Restrict direct LAN access to backend ports `4000` and `6000` on `10.109.112.94` using macOS PF firewall rules.
4. **High-Availability Backend Failover (Extension D)**: Validate Nginx continuity when one backend fails (`200 OK` via remaining backend), behavior when both backends fail (`502 Bad Gateway`), and automatic recovery upon restart.
5. **Controlled Edge Migration (Extension E)**: Deploy Standby Nginx on the Secondary Mac (`10.109.112.62`), cut over DNS records to `10.109.112.62`, stop Primary Nginx, and validate HTTPS and round-robin load balancing through the standby proxy.

---

## 3. Backup DNS Implementation

To remove the Primary Mac (`10.109.112.94`) as a single point of failure for name resolution, a secondary `dnsmasq` instance was installed and configured on Varun's Mac (`10.109.112.62`) at `/opt/homebrew/etc/dnsmasq.conf` (archived in [configs/dnsmasq/backup-dnsmasq.conf](../configs/dnsmasq/backup-dnsmasq.conf)):

- **Listeners**: `127.0.0.1` and `10.109.112.62` on UDP port `53` (`bind-interfaces`).
- **Authoritative Local Records**: `app.team1.test` and `api.team1.test` resolving to `10.109.112.62`.
- **Upstream Forwarders**: `8.8.8.8` and `1.1.1.1` (`no-resolv`).
- **Query Logging**: Enabled via `log-queries` to `/tmp/dnsmasq-backup.log`.

Client network DNS settings were configured with `10.109.112.94` as primary and `10.109.112.62` as secondary.

---

## 4. DNS TTL Configuration

Both the primary and backup `dnsmasq` servers configure:

```ini
local-ttl=30
```

Setting a 30-second TTL ensures downstream clients cache `app.team1.test` and `api.team1.test` A records for at most 30 seconds before re-querying.

> **Verification Scope Note**: While `local-ttl=30` is configured and verified in the `dnsmasq` configuration, a live **record-change countdown and manual client-side DNS cache-flush (`dscacheutil -flushcache` / `mDNSResponder`) demonstration** has **not yet been verified** and is explicitly marked `NOT VERIFIED` in Section 12.

---

## 5. DNS Failure and Recovery Testing

During testing, the primary `dnsmasq` service on `10.109.112.94` was stopped while the client maintained both `10.109.112.94` and `10.109.112.62` in its resolver list. Queries for `app.team1.test` and `api.team1.test` successfully fell back to the backup `dnsmasq` service on `10.109.112.62` and returned valid A records (`10.109.112.62`).

**Key Networking Distinction**:
- **DNS Failure**: Name resolution times out or fails (`NXDOMAIN`/timeout), even though IP connectivity (`ping`) and backend services remain operational.
- **Application Failure**: DNS resolves normally to the edge IP, TCP and TLS handshakes succeed, and Nginx returns HTTP `502 Bad Gateway` when upstream Express processes are down.

---

## 6. Backend Firewall Isolation

In Phase 1, Backend A (`4000`) and Backend B (`6000`) bound strictly to `127.0.0.1` on the Primary Mac. To allow Standby Nginx on the Secondary Mac (`10.109.112.62`) to reach the backends across the LAN, both Express processes on `10.109.112.94` were bound to `0.0.0.0`, and macOS Packet Filter (`pf`) rules were loaded on `10.109.112.94` (documented in [configs/pf/cn_project.anchor.conf](../configs/pf/cn_project.anchor.conf)):

- **Allowed**: Loopback (`lo0`) traffic and inbound TCP traffic from `10.109.112.62` to ports `4000` and `6000`.
- **Blocked**: All other inbound TCP traffic to ports `4000` and `6000`.

Verification confirmed that PF rules were loaded and the permitted Secondary Mac (`10.109.112.62`) could reach both backend ports.

> **Scope Caveat**: PF operates at Layer 3/4 (source IP/port). The allow rule authorizes the Secondary Mac IP (`10.109.112.62`) as a host rather than restricting access exclusively to the `nginx` process on that machine. In addition, an independent third-party LAN client test confirming the `block` rule drop behavior has not yet been recorded (`NOT VERIFIED`).

---

## 7. Backend Failover Testing

Nginx distributes incoming requests round-robin across Backend A (`4000`) and Backend B (`6000`), identified by the `X-Backend` response header.

1. **Single-Backend Failure**: Backend A (`4000`) was stopped. Subsequent HTTPS requests continued returning `200 OK`, served exclusively by Backend B (`X-Backend: B`).
2. **Backend Recovery**: Backend A (`4000`) was restarted. Subsequent requests automatically resumed alternating between `X-Backend: A` and `X-Backend: B`.

---

## 8. Both-Backends-Down Test

Both Backend A (`4000`) and Backend B (`6000`) were stopped simultaneously while DNS and Nginx remained running:

- **Observed Result**: DNS resolution succeeded, the TCP connection and TLS handshake completed normally at Nginx, and Nginx returned **HTTP `502 Bad Gateway`**.
- **Recovery**: Restarting both Backend A and Backend B immediately restored **HTTP `200 OK`** responses.
- **Architectural Lesson**: This cleanly isolates the edge proxy boundary (DNS + TCP + TLS succeeded) from the upstream application layer (`502` indicates unreachable upstream targets).

---

## 9. Standby Nginx Implementation

To eliminate Primary Nginx (`10.109.112.94`) as a single point of failure, Standby Nginx was deployed on Varun's Mac (`10.109.112.62`) at `~/cn-standby/nginx.conf` (archived in [configs/nginx/standby-nginx.conf](../configs/nginx/standby-nginx.conf)):

- Listens on port `80` (HTTP) and port `443` (`ssl`, `http2 on`).
- Uses the same CA-signed server certificate pair (`app.pem` and `app-key.pem`) issued by `CN_Project Local Root CA`.
- Defines `upstream backends` pointing across the LAN to `10.109.112.94:4000` and `10.109.112.94:6000`.

---

## 10. DNS Cutover and HTTPS Verification

To simulate primary edge failure and controlled migration:

1. Both primary and backup `dnsmasq` servers were configured to resolve `app.team1.test` and `api.team1.test` to `10.109.112.62` (Standby Nginx).
2. Primary Nginx on `10.109.112.94` was stopped.
3. HTTPS requests to `https://app.team1.test` and `https://api.team1.test` succeeded with trusted certificate validation (using `certs/rootCA.pem` in the macOS System Keychain, without bypassing TLS verification).

---

## 11. Standby Load-Balancing Results

After cutting over DNS to `10.109.112.62` and stopping Primary Nginx on `10.109.112.94`, **8 consecutive HTTPS requests** were sent through Standby Nginx on Varun's Mac:

- **Total Requests**: `8`
- **Successful Responses (`200 OK`)**: `8 / 8`
- **Backend A (`X-Backend: A`, `10.109.112.94:4000`)**: `4` responses
- **Backend B (`X-Backend: B`, `10.109.112.94:6000`)**: `4` responses

This confirmed balanced `50% / 50%` round-robin distribution from the Standby Nginx edge across the LAN to both backends on the Primary Mac.

---

## 12. Phase 2 Test-Results Summary Table

| Test ID | Test Case | Procedure | Expected Result | Actual Verified Result | Status |
| --- | --- | --- | --- | --- | --- |
| **T1** | Two-Mac LAN Connectivity | Connect both Macs (`10.109.112.94`, `10.109.112.62`) to same Wi-Fi LAN and ping | Bidirectional ICMP replies | Both Macs communicate cleanly over the same LAN | **VERIFIED** |
| **T2** | Primary & Backup DNS Resolution | Query `app.team1.test` & `api.team1.test` on `.94` and `.62` | Both return configured A record (`10.109.112.62`) | Primary & backup `dnsmasq` both resolve both domains | **VERIFIED** |
| **T3** | DNS TTL Configuration | Inspect `local-ttl` setting in `dnsmasq.conf` | TTL configured to 30 seconds | `local-ttl=30` configured in primary & backup `dnsmasq` | **VERIFIED** |
| **T4** | Primary DNS Failure & Backup Failover | Stop primary `dnsmasq` on `.94`; query domains from client | Client fails over to backup DNS `.62` and resolves names | Backup resolver on `.62` resolved domains after primary stopped | **VERIFIED** |
| **T5** | Live DNS Record Change & Client Cache-Flush Demo | Resolve name -> alter A record -> observe 30s cached response -> run `dscacheutil -flushcache` | Old IP returned until TTL expiry or manual flush | Not yet executed/captured as a controlled timed test | **NOT VERIFIED** |
| **T6** | Backend A & B Availability | Query Backend A (`4000`) and Backend B (`6000`) endpoints | Both respond with `200 OK` and `X-Backend` header | Backend A and Backend B both respond successfully | **VERIFIED** |
| **T7** | Nginx Round-Robin Load Balancing | Send repeated requests through Nginx edge | Traffic alternates between Backend A and Backend B | Nginx distributes requests across Backend A and Backend B | **VERIFIED** |
| **T8** | Trusted HTTPS / TLS Validation | Trust `certs/rootCA.pem` on client; request `https://app.team1.test` without `-k` | Valid TLS handshake and zero cert warnings | HTTPS certificate validation succeeds after trusting root CA | **VERIFIED** |
| **T9** | HTTP Caching (`ETag` / `304`) | Request `/api/cached`, then send `If-None-Match: "v1"` | `Cache-Control: max-age=60`, `ETag: "v1"`, and `304 Not Modified` | `/api/cached` supports ETag and HTTP `304` responses | **VERIFIED** |
| **T10** | Single-Backend Failover & Recovery | Stop Backend A -> send requests -> restart Backend A | Requests continue via Backend B; load balancing resumes on restart | Stopping A serves via B; restarting A restores load balancing | **VERIFIED** |
| **T11** | Both-Backends-Down & Recovery | Stop Backend A and Backend B -> request edge -> restart both | Nginx returns `502 Bad Gateway`; restarts restore `200 OK` | Stopping both produced HTTP `502`; restarting restored `200` | **VERIFIED** |
| **T12** | PF Firewall Load & Permitted Host Reachability | Load PF anchor on `.94`; test ports `4000` & `6000` from `.62` | PF rules loaded; `.62` reaches ports `4000` and `6000` | PF rules loaded and verified; `.62` accessed both backend ports | **VERIFIED** |
| **T13** | PF Firewall Block from Third-Party LAN Host | Attempt direct TCP `4000`/`6000` from a non-`.62` LAN host | Connection dropped/blocked by PF anchor | Not yet tested from a third independent LAN host | **NOT VERIFIED** |
| **T14** | Standby Nginx Cutover After Primary Stop | Stop Primary Nginx on `.94`; access app via DNS -> `.62` | Standby Nginx serves HTTPS application seamlessly | Standby Nginx on `.62` successfully served app after primary stopped | **VERIFIED** |
| **T15** | Standby Nginx Load-Balancing Distribution | Send 8 HTTPS requests to Standby Nginx on `.62` | 8 `200 OK` responses balanced across A and B | 8 successful HTTPS requests: `4` Backend A, `4` Backend B | **VERIFIED** |

---

## 13. Troubleshooting and Observations

1. **Cross-Mac Backend Binding**: During Phase 1, both Express backends bound to `127.0.0.1` so only the local Primary Nginx could reach them. Moving to Standby Nginx on `10.109.112.62` required binding both backends on the Primary Mac to `0.0.0.0`, which in turn necessitated the PF firewall anchor to avoid exposing ports `4000`/`6000` to the entire LAN.
2. **Layer Isolation via Error Signatures**:
   - DNS misconfiguration (observed in Phase 1 historical diagnostics when `dnsmasq.conf` pointed to unreachable `.250`) resulted in name-resolution redirection to a dead IP despite healthy backends.
   - Stopping both backends produced HTTP `502 Bad Gateway` while TLS remained valid, demonstrating clear separation between TLS termination at the edge and upstream application health.
3. **Standby Nginx vs. Primary Nginx Parity**: The active Standby Nginx configuration (`~/cn-standby/nginx.conf`) validates HTTPS and round-robin balancing cleanly, though it omits `return 301` on port `80` and explicit `max_fails`/`proxy_next_upstream` directives present in the Primary Nginx config.

---

## 14. Limitations and Conclusion

### Key Architectural Limitations

1. **Process-Level, Not Machine-Level Backend Redundancy**: Both Backend A (`4000`) and Backend B (`6000`) run as separate Node.js processes on the **same Primary Mac (`10.109.112.94`)**. While this proves application-process failover and recovery, a full hardware failure or Wi-Fi disconnect on the Primary Mac would take both backends offline simultaneously. True machine-level redundancy requires hosting Backend B on a separate machine (such as `10.109.112.62` or a third laptop).
2. **Host-IP Firewall Granularity**: macOS PF filters packets by source IP (`10.109.112.62`), meaning any client or tool executing on the Secondary Mac can connect to ports `4000`/`6000`, not exclusively the Nginx process.
3. **Unverified Items**: Timed DNS TTL cache-expiry/flush demonstration (`T5`) and third-host PF block verification (`T13`) remain `NOT VERIFIED` and should be completed prior to final grading if a third device is available.

### Conclusion

Phase 2 successfully hardened the **Private Network Service Platform** across two MacBooks. With backup DNS (`10.109.112.62`), standby HTTPS edge proxying (`10.109.112.62`), PF firewall rules protecting `4000`/`6000`, and verified failover for single-backend, dual-backend, primary-DNS, and primary-Nginx outages, the platform demonstrates end-to-end resilience while clearly documenting its remaining single-host backend limitation.
