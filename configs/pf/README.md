# macOS PF Firewall Instructions (Primary Mac: 10.109.112.94)

This directory contains the macOS Packet Filter (`pf`) anchor rules used for **Phase 2 Extension C (Service Isolation)** on the Primary Mac (`10.109.112.94`).

Because Express Backend A (`:4000`) and Backend B (`:6000`) must bind to `0.0.0.0` so that the Standby Nginx proxy on the Secondary Mac (`10.109.112.62`) can reach them across the LAN, a host-based firewall is required to prevent arbitrary LAN clients from bypassing the Nginx edge proxy.

---

## Rule Summary

Defined in [cn_project.anchor.conf](cn_project.anchor.conf):

1. **Loopback Allow**: Permits `lo0` TCP traffic to ports `4000` and `6000` so Primary Nginx on `10.109.112.94` can reach local backends.
2. **Secondary Mac Allow**: Permits inbound TCP traffic from `10.109.112.62` to ports `4000` and `6000` so Standby Nginx on the Secondary Mac can proxy to the backends.
3. **Default Deny on Backend Ports**: Blocks all other inbound TCP connections to ports `4000` and `6000`.

> **Security Scope Note**: `pf` operates at the IP/TCP layers (`L3`/`L4`), so the rule permits source IP `10.109.112.62` rather than restricting access to the `nginx` binary exclusively.

---

## Installation & Activation (Primary Mac)

1. Back up the default PF configuration before editing:
   ```sh
   sudo cp /etc/pf.conf /etc/pf.conf.backup
   ```

2. Install the anchor file:
   ```sh
   sudo cp configs/pf/cn_project.anchor.conf /etc/pf.anchors/cn_project
   sudo chmod 644 /etc/pf.anchors/cn_project
   ```

3. Register the anchor in `/etc/pf.conf` (after the existing `com.apple` anchor lines):
   ```text
   anchor "cn_project"
   load anchor "cn_project" from "/etc/pf.anchors/cn_project"
   ```

4. Validate syntax without loading:
   ```sh
   sudo pfctl -vnf /etc/pf.conf
   ```

5. Load rules and enable PF:
   ```sh
   sudo pfctl -ef /etc/pf.conf
   ```
   *(If PF is already enabled, reload rules with `sudo pfctl -f /etc/pf.conf`.)*

---

## Verification

- Inspect active rules in the anchor:
  ```sh
  sudo pfctl -a cn_project -sr
  ```
- Inspect PF overall status:
  ```sh
  sudo pfctl -s info
  ```
- From the permitted Secondary Mac (`10.109.112.62`), verify backend ports are reachable:
  ```sh
  nc -zv 10.109.112.94 4000
  nc -zv 10.109.112.94 6000
  ```
- From any other LAN device (e.g., a third device on the hotspot, not `10.109.112.62`), direct connections to `10.109.112.94:4000` or `:6000` are blocked while HTTPS via port `443` remains accessible.

---

## Rollback

To restore the original macOS PF state:
```sh
sudo cp /etc/pf.conf.backup /etc/pf.conf
sudo pfctl -F all -f /etc/pf.conf
```
Or disable PF entirely if it was not previously running:
```sh
sudo pfctl -d
```
