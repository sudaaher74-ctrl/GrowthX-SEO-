# Local host availability watchdog

`scripts/crawler-watchdog.sh` is the source for the existing local-host watchdog. Deploy this committed file as the host user's watchdog script; keep the Compose environment and Cloudflare credentials outside Git. The defaults preserve the current project, lock and credential-file locations. Optional path overrides are documented by the environment-variable names at the top of the script.

Public probes alone do not prove a connector has failed. A single failed request must not tear down healthy Cloudflare connections. The watchdog now requires three consecutive failed public probes, checks the local API, and inspects local Cloudflare connection metrics before considering a tunnel restart. A healthy origin with any connected replica is retained. Origin failure continues to use the separate three-probe API-only repair policy.

Changing the watchdog does not require an API, worker, database or tunnel restart. Stop only the old watchdog process and its probe/sleep children, replace its script with the committed version, and start one watchdog instance. The inherited lock prevents overlapping controllers. Detached cloudflared processes close the watchdog lock descriptor.

Run `bash scripts/test-crawler-watchdog.sh` before deployment. Its isolated probes verify transient failures, connected replicas, three-failure repair, recovery resets, and preservation of the tunnel during origin failure. It neither connects to Redis/database nor changes real services.

This improves repair behaviour on the existing host. It does not provide another host, remove the Windows/WSL dependency, or establish an availability SLA.
