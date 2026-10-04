# Evidence index

## Phase 1 Build Evidence

- `phase-1/A-lan-setup/` — interface, IPv4/subnet, gateway, and ping screenshots across machines.
- `phase-1/B-dns/` — client DNS settings, dnsmasq configuration/logs, and `dig` resolution results for `app` and `api`.
- `phase-1/C-backends-and-D-load-balancing/` — backend direct checks, nginx configuration/access logs, and edge proxy responses.
- `phase-1/E-https-or-tls/` — browser certificate trust, green padlock, and verbose TLS handshake output.
- `phase-1/F-caching/` — `Cache-Control`, `ETag`, and conditional `304 Not Modified` responses.
- `phase-1/G-wireshark/` — DNS query/response, TCP three-way handshake, TLS handshake, and encrypted application data.
- `phase-1/failures/` — Section 6.3 deliberate failure scenarios demonstrating layer independence and fault isolation.

## Diagnostics & Historical Captures

- `diagnostics/` — captures demonstrating DNS misconfiguration troubleshooting and record recovery.
- Files named `historical-*` in `C-backends-and-D-load-balancing/` predate the current round-robin setup.

## Deliverables & Status Summary

| Area | Current Evidence Status | Action Needed |
|---|---|---|
| **Task A (LAN)** | Complete | None |
| **Task B (DNS)** | Complete | None |
| **Task C & D (Backends & Load Balancer)** | Partially Complete | Capture single screenshot of alternating `X-Backend: A/B` round-robin |
| **Task E (HTTPS/TLS)** | Complete | None |
| **Task F (Caching)** | Complete | None |
| **Task G (Wireshark)** | Complete | None |
| **Section 6.3 (Failures)** | 2 of 5 present | Capture remaining 3 failure scenarios (One backend down, Both backends down, Wrong port) |

