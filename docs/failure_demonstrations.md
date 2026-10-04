# Phase 1 Required Failure Demonstrations Runbook

This document details the **5 mandatory failure scenarios** from **Section 6.3** of the course project specification. For each scenario, it explains:
- **Concept Proven** (what theory is being evaluated)
- **Where to execute** (Server Mac vs. Client Mac)
- **When to execute** (Prerequisites & sequence)
- **How to execute** (Commands to trigger the fault, observe the outcome, and restore the service)
- **Expected Terminal Output** (what to verify)
- **Screenshot Naming** (to store under `evidence/phase-1/failures/`)
- **Viva Defense** (what to explain out loud to the faculty evaluator)

---

## Quick Reference Summary

| # | Failure Scenario | Where to Break | Where to Test | Screenshot File Name (`evidence/phase-1/failures/`) | Concept Illustrated |
|---|------------------|----------------|---------------|-----------------------------------------------------|----------------------|
| **1** | **Wrong DNS server configured on client** | Client Mac | Client Mac | `01-wrong-dns-server.png` | DNS and IP layers are independent |
| **2** | **DNS record points to a wrong IP address** | Server Mac (`dnsmasq.conf`) | Client Mac | `02-dns-wrong-ip-record.png` | DNS is a directory, not a connection |
| **3** | **One backend is stopped** | Server Mac (Kill Backend A) | Client Mac | `03-one-backend-stopped-failover.png` | Reverse proxy load balancing & upstream failover |
| **4** | **Both backends are stopped** | Server Mac (Kill Backend B as well) | Client Mac | `04-both-backends-stopped-502.png` | Separation of Edge (TLS/Proxy) and Backend application layers (502 Bad Gateway) |
| **5** | **Wrong destination port on client** | Client Mac (request port 9999) | Client Mac | `05-wrong-destination-port.png` | Host IP vs. TCP Port separation (Connection Refused / TCP RST) |

---

## Scenario 1: Wrong DNS Server Configured on Client

### 1. Concept Proven
Demonstrates that the **DNS layer (Application)** and **IP layer (Network)** are decoupled. Even when physical and IP layer connectivity between Client and Server is 100% operational (`ping` succeeds), domain name lookups (`dig` or `curl`) completely fail if the DNS resolver address is misconfigured or unreachable.

### 2. When to do it
Execute this as your first test after verifying that normal Phase 1 operations (DNS resolution, HTTPS, load balancing) work.

### 3. Where to do it
- **Break & Test Location:** Entirely on the **Client Mac**.
- *(No changes needed on Server Mac).*

### 4. How to do it (Step-by-Step)

#### Step A: Misconfigure DNS on Client Mac
Point the client Mac's DNS resolver to an invalid / non-DNS IP address (e.g. `192.0.2.1` or `10.7.10.99`):
```bash
# Set DNS server to an unreachable dummy IP
sudo networksetup -setdnsservers Wi-Fi 192.0.2.1

# Flush macOS local DNS resolver cache
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```
*(Alternatively, do this via macOS GUI: System Settings → Wi-Fi → Details → DNS → change IP to `192.0.2.1`)*

#### Step B: Demonstrate the Failure
Run `dig` and `curl` on the Client Mac:
```bash
# 1. Test DNS resolution (fails with timeout)
dig app.team1.test

# 2. Test application access (fails with resolution error)
curl -v https://app.team1.test/
```
**Expected Observation:**
- `dig` outputs: `;; connection timed out; no servers could be reached`
- `curl` outputs: `curl: (6) Could not resolve host: app.team1.test`

#### Step C: Prove Layer Independence (IP connectivity still works!)
Immediately ping the Server Mac's IP (e.g., `10.7.10.207`):
```bash
ping -c 3 10.7.10.207
```
**Expected Observation:**
- `0.0% packet loss`! The ping succeeds with low latency.

#### Step D: Restore Normal Setup
```bash
# Restore Client DNS back to the Server Mac IP
sudo networksetup -setdnsservers Wi-Fi 10.7.10.207

# Flush DNS cache
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### 5. Recommended Screenshot Name
Save terminal screenshot as:
`evidence/phase-1/failures/01-wrong-dns-server.png`
*(Tip: Capture a terminal split or stacked output showing `curl: (6) Could not resolve host` alongside the successful `ping 10.7.10.207`).*

### 6. Viva Explanation
> *"Here we misconfigured the client's DNS resolver to an unreachable IP. As expected, `curl https://app.team1.test` and `dig` failed immediately with host resolution errors. However, pinging the server IP `10.7.10.207` directly succeeded with 0% packet loss. This demonstrates the fundamental modularity of the OSI/TCP-IP model: the Network layer (IP routing) operates independently of the Application layer (DNS resolution)."*

---

## Scenario 2: DNS Record Points to a Wrong IP Address

### 1. Concept Proven
Demonstrates that **DNS is merely a directory service (mapping names to numbers), not an actual network connection**. The DNS query itself succeeds and returns an answer, but the client is directed to a wrong or non-existent destination host, causing subsequent TCP/TLS connection attempts to fail.

### 2. When to do it
Execute after Scenario 1 is restored.

### 3. Where to do it
- **Configuration Change:** On the **Server Mac** (`configs/dnsmasq/dnsmasq.conf`).
- **Test Commands & Verification:** On the **Client Mac**.

### 4. How to do it (Step-by-Step)

#### Step A: Point DNS Record to Wrong IP on Server Mac
Open `configs/dnsmasq/dnsmasq.conf` on the Server Mac and change the host record to an unused IP (e.g. `10.7.10.250`):
```text
host-record=app.team1.test,10.7.10.250
host-record=api.team1.test,10.7.10.250
```
Restart `dnsmasq` on Server Mac:
```bash
sudo killall dnsmasq
sudo dnsmasq -C /Users/musthyalasadhvik/Desktop/CN_Project/configs/dnsmasq/dnsmasq.conf
```

#### Step B: Demonstrate the Failure on Client Mac
Flush DNS cache and test:
```bash
# Flush DNS cache
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# 1. DNS Query succeeds!
dig app.team1.test +short

# 2. Connection fails at TCP layer!
curl -v --connect-timeout 4 https://app.team1.test/
```
**Expected Observation:**
- `dig` returns `10.7.10.250` (DNS query succeeded! Status: `NOERROR`).
- `curl` hangs for 4 seconds and outputs:
  `curl: (28) Failed to connect to app.team1.test port 443 after 4000 ms: Couldn't connect to server` (or `curl: (7) Failed to connect... Connection refused`).

#### Step C: Restore Normal Setup
On Server Mac, revert `dnsmasq.conf` back to the real Server IP:
```text
host-record=app.team1.test,10.7.10.207
host-record=api.team1.test,10.7.10.207
```
Restart `dnsmasq`:
```bash
sudo killall dnsmasq
sudo dnsmasq -C /Users/musthyalasadhvik/Desktop/CN_Project/configs/dnsmasq/dnsmasq.conf
```
On Client Mac:
```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

### 5. Recommended Screenshot Name
Save terminal screenshot as:
`evidence/phase-1/failures/02-dns-wrong-ip-record.png`
*(Tip: Capture terminal showing `dig` returning `10.7.10.250` followed by `curl: (28) Failed to connect...`).*

### 6. Viva Explanation
> *"In this scenario, dnsmasq returned an incorrect IP address (10.7.10.250). Notice that `dig` succeeded with status NOERROR because DNS only functions as a telephone directory. However, when the client attempted to establish a TCP three-way handshake (SYN) to that IP on port 443, no host responded, resulting in a connection timeout. This proves DNS does not validate destination availability—it only provides address translation."*

---

## Scenario 3: One Backend is Stopped (High Availability Failover)

### 1. Concept Proven
Demonstrates **reverse proxy load balancer resilience and active/passive failover**. When an upstream application instance goes down, nginx detects the connection refusal and automatically reroutes traffic to the surviving backend without the client encountering any errors or dropped requests.

### 2. When to do it
Execute when both backends are running and round-robin load balancing is active (showing alternating `X-Backend: A` and `X-Backend: B`).

### 3. Where to do it
- **Service Action:** On the **Server Mac** (Stop Backend A).
- **Test Commands & Verification:** On the **Client Mac**.

### 4. How to do it (Step-by-Step)

#### Step A: Stop Backend A on Server Mac
In the terminal running Backend A (`port 4000`), press `Ctrl + C`, or execute:
```bash
kill -9 $(lsof -ti:4000)
```
Verify port 4000 is stopped while port 6000 (Backend B) is still alive:
```bash
lsof -i :4000    # (Empty output - stopped)
lsof -i :6000    # (node process is still listening)
```

#### Step B: Test on Client Mac
Run repeated requests through the HTTPS edge:
```bash
for i in {1..6}; do curl -s -i https://app.team1.test/ | grep -E "HTTP|X-Backend"; done
```
**Expected Observation:**
Every single response returns `HTTP/2 200 OK` (or `HTTP/1.1 200 OK`) with:
```text
X-Backend: B
X-Backend: B
X-Backend: B
X-Backend: B
X-Backend: B
X-Backend: B
```
Backend A is cleanly bypassed. The client experiences 0 downtime.

#### Step C: Inspect Nginx Error Log on Server Mac (Optional but High-Impacting Evidence)
```bash
tail -n 5 /tmp/cn_project_nginx_error.log
```
**Expected Observation:**
Nginx logs a warning: `connect() failed (61: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:4000/"`. Thanks to `proxy_next_upstream`, nginx immediately retried upstream `http://127.0.0.1:6000/`.

#### Step D: Keep Backend A stopped (proceed directly to Scenario 4) OR Restore
If restoring now:
```bash
cd /Users/musthyalasadhvik/Desktop/CN_Project/backendA && npm start
```

### 5. Recommended Screenshot Name
Save terminal screenshot as:
`evidence/phase-1/failures/03-one-backend-stopped-failover.png`
*(Tip: Capture the client loop output showing consecutive `X-Backend: B` responses, optionally side-by-side with `lsof -i :4000` showing no process).*

### 6. Viva Explanation
> *"We stopped Backend A on port 4000. Because our nginx upstream configuration includes `max_fails=2 fail_timeout=10s` and `proxy_next_upstream error timeout http_502`, nginx automatically detected the failure on 127.0.0.1:4000 and seamlessly proxied all requests to Backend B. The client experienced uninterrupted service with 200 OK responses, demonstrating reverse proxy fault tolerance."*

---

## Scenario 4: Both Backends are Stopped

### 1. Concept Proven
Demonstrates **service layer boundaries and the role of an edge reverse proxy**. When all application backends are offline, DNS resolution, TCP three-way handshake, and TLS handshake still complete successfully at the edge (nginx), but nginx has no reachable upstream server to fulfill the HTTP request, triggering an HTTP `502 Bad Gateway`.

### 2. When to do it
Execute immediately after Scenario 3, or stop both backends together.

### 3. Where to do it
- **Service Action:** On the **Server Mac** (Stop both Backend A and Backend B).
- **Test Commands & Verification:** On the **Client Mac**.

### 4. How to do it (Step-by-Step)

#### Step A: Stop Both Backends on Server Mac
```bash
kill -9 $(lsof -ti:4000) 2>/dev/null
kill -9 $(lsof -ti:6000) 2>/dev/null
```
Verify neither backend is listening, while nginx is still running:
```bash
lsof -i :4000 -i :6000    # (Empty output - both stopped)
lsof -i :443              # (nginx master/worker processes are listening)
```

#### Step B: Test on Client Mac
Run `curl -i` and verbose `curl -v`:
```bash
# 1. Check HTTP response status
curl -i https://app.team1.test/

# 2. Check full TLS connection details
curl -v https://app.team1.test/
```
**Expected Observation:**
- The TCP connection to port 443 succeeds.
- The TLS handshake completes successfully (CN_Project Local Root CA validated, cipher negotiated).
- The HTTP response status is:
  `HTTP/2 502 Bad Gateway` (or `502 Bad Gateway`).
- Body: `<html>...<center>502 Bad Gateway</center>...</html>`

#### Step C: Inspect Nginx Error Log on Server Mac
```bash
tail -n 6 /tmp/cn_project_nginx_error.log
```
**Expected Observation:**
`no live upstreams while connecting to upstream` or `connect() failed (61: Connection refused) while connecting to upstream: "http://backends"`.

#### Step D: Restore Normal Setup
Restart both backends in their respective directories or terminal windows:
```bash
# Terminal 1:
cd /Users/musthyalasadhvik/Desktop/CN_Project/backendA && npm start

# Terminal 2:
cd /Users/musthyalasadhvik/Desktop/CN_Project/backendB && npm start
```

### 5. Recommended Screenshot Name
Save terminal screenshot as:
`evidence/phase-1/failures/04-both-backends-stopped-502.png`
*(Tip: Capture client terminal showing the TLS handshake succeeded followed by `HTTP/2 502 Bad Gateway`).*

### 6. Viva Explanation
> *"With both Express backends terminated, the client can still resolve `app.team1.test` and complete both the TCP and TLS handshakes with nginx at the edge. However, when nginx tries to proxy the HTTP request to the upstream pool (127.0.0.1:4000 and 127.0.0.1:6000), both connections are refused. Nginx therefore returns an RFC-compliant `502 Bad Gateway`. This clearly delineates where the edge reverse proxy ends and where the backend application layer begins."*

---

## Scenario 5: Wrong Destination Port on the Client

### 1. Concept Proven
Demonstrates **Transport Layer (L4) addressing vs Network Layer (L3) addressing**. An IP address identifies a specific host interface on the network, while a port number identifies a specific socket/process running on that host. Reaching a host via IP does not mean every TCP port is open.

### 2. When to do it
Execute when normal setup is active.

### 3. Where to do it
- **Action & Test Location:** Entirely on the **Client Mac**.
- *(No changes needed on Server Mac).*

### 4. How to do it (Step-by-Step)

#### Step A: Attempt Connection to Unopened Port from Client Mac
Connect to port `9999` (or any closed TCP port):
```bash
curl -v --connect-timeout 3 https://app.team1.test:9999/
```
**Expected Observation:**
```text
*   Trying 10.7.10.207:9999...
* connect to 10.7.10.207 port 9999 failed: Connection refused
* Failed to connect to app.team1.test port 9999: Connection refused
* Closing connection 0
curl: (7) Failed to connect to app.team1.test port 9999: Connection refused
```

#### Step B: Prove Host IP is Reachable & Correct Port is Working
In the same terminal session:
```bash
# 1. Prove host is alive at L3 (Network layer)
ping -c 3 app.team1.test

# 2. Prove valid service port (443) connects immediately at L4 (Transport layer)
curl -sI https://app.team1.test:443/ | head -n 1
```
**Expected Observation:**
- `ping` gives 0% packet loss.
- `curl ...:443/` returns `HTTP/2 200`.

### 5. Recommended Screenshot Name
Save terminal screenshot as:
`evidence/phase-1/failures/05-wrong-destination-port.png`
*(Tip: Capture terminal showing `curl: (7) Connection refused` on port 9999 right above the successful `ping` and successful `curl` on port 443).*

### 6. Viva Explanation
> *"When we queried port 9999, the operating system kernel on the server Mac received our TCP SYN packet, found no process listening on port 9999, and immediately returned a TCP RST (reset) packet, producing `Connection refused`. Yet, pinging the exact same domain succeeds, and connecting to port 443 succeeds. This proves that IP addresses identify hosts, whereas TCP port numbers multiplex distinct network applications on that host."*

---

## Terminal Setup & Screenshot Capture Best Practices

1. **Terminal Layout:**
   - Use **iTerm2** or macOS **Terminal** with split panes (e.g. Server Mac output on top or left, Client Mac commands on bottom or right).
   - Alternatively, on the Client Mac, display the failure command followed directly by the isolation/ping command so the evaluator sees both cause and proof in a single window.
2. **Clear Screen Before Test:**
   - Type `clear` before running the demonstration commands so the screenshot is clean and uncluttered.
3. **Evidence Folder Location:**
   - Place all five screenshot files directly in:
     ```text
     evidence/phase-1/failures/
     ├── 01-wrong-dns-server.png
     ├── 02-dns-wrong-ip-record.png
     ├── 03-one-backend-stopped-failover.png
     ├── 04-both-backends-stopped-502.png
     └── 05-wrong-destination-port.png
     ```
4. **Fast 30-Second Retrieval:**
   - Per Section 9 of the project rubric, *"The evaluator should be able to find any piece of evidence within 30 seconds."* Keeping the numbering prefix (`01-`, `02-`, etc.) ensures the files sort in exact demonstration order!
