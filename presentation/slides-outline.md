# Final Presentation Slide Outline

Deck files: [CN_Project_Final_Presentation.pdf](CN_Project_Final_Presentation.pdf) (PDF) | [CN_Project_Final_Presentation.pptx](CN_Project_Final_Presentation.pptx) (PPTX) — 12 slides, 16:9 widescreen

| Slide | Title | Key Points |
| --- | --- | --- |
| **1** | **Title & Team** | Private Network Service Platform — Two-Phase Computer Networks Project (`app.team1.test` / `api.team1.test`, Primary Mac `10.109.112.94` & Secondary Mac / Varun's Mac `10.109.112.62`). |
| **2** | **Problem Statement & Objectives** | Build a fully local client-to-backend stack without cloud services (Phase 1), then harden DNS, edge proxy, and backend access for resilience and controlled failover (Phase 2). |
| **3** | **System Architecture** | End-to-end two-Mac diagram: Client -> Primary/Backup `dnsmasq` -> Primary/Standby `nginx` (HTTPS) -> PF Firewall -> Express Backend A (`4000`) & B (`6000`). |
| **4** | **LAN Topology & IP Allocation** | Detailed IP, role, and port table (`10.109.112.94` vs. `10.109.112.62`; `53/UDP`, `80/TCP`, `443/TCP`, `4000/TCP`, `6000/TCP`). |
| **5** | **Private DNS Implementation** | `.test` namespace (`app.team1.test`, `api.team1.test`), `dnsmasq` primary & backup configs, `local-ttl=30`, upstream forwarders `8.8.8.8`/`1.1.1.1`. |
| **6** | **Backend Services & Load Balancing** | Express `^5.2.1` endpoints (`/`, `/api/data`, `/api/status`, `/api/cached`), `X-Backend: A/B`, round-robin distribution, passive health checks. |
| **7** | **HTTPS/TLS & HTTP Caching** | Two-tier PKI (`CN_Project Local Root CA` + SAN cert `app.pem`), TLS 1.2/1.3 + HTTP/2 edge termination, `Cache-Control: max-age=60`, `ETag: "v1"`, `304 Not Modified`. |
| **8** | **Firewall & Backend Isolation** | Phase 2 `0.0.0.0` binding + macOS PF anchor (`cn_project`) allowing `lo0` and `10.109.112.62` on TCP `4000`/`6000`, blocking other inbound TCP; host-IP scope disclosure. |
| **9** | **Phase 2 DNS & Nginx Failover** | Backup `dnsmasq` continuity when primary stops; Standby Nginx cutover on `.62` serving `8/8` HTTPS requests (`4` Backend A, `4` Backend B) when primary Nginx stops. |
| **10** | **Testing Results & Troubleshooting** | Verified matrix (13 verified items + 2 `NOT VERIFIED` items: cache-flush demo and third-host PF drop test) and layer-by-layer isolation insights (`502 Bad Gateway` vs DNS). |
| **11** | **Limitations & Future Improvements** | Process-level vs machine-level backend redundancy (both backends on `.94`), IP-based PF scope, manual DNS cutover, and roadmap for true multi-host backends. |
| **12** | **Conclusion & Demonstration Flow** | 11-step live evaluation & viva sequence (LAN ping -> `dig` -> HTTPS -> `X-Backend` LB -> Wireshark -> `304` -> failover -> Phase 2 resilience -> troubleshooting). |
