import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";

export function awtrixDiscoveryTarget(host) {
  const url = new URL(host);
  const match = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.local$/i.exec(url.hostname);
  if (url.protocol !== "http:" || !match || url.username || url.password) return null;
  return { hostname: match[1].toLowerCase(), port: Number(url.port || 80) };
}

function ipv4Number(address) {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.reduce((value, part) => (value * 256 + Number(part)) >>> 0, 0);
}

function privateAddress(value) {
  return value >>> 24 === 10 || value >>> 20 === 0xac1 || value >>> 16 === 0xc0a8;
}

function subnetList(interfaces) {
  return Object.values(interfaces).flat().flatMap((entry) => {
    if (entry.internal || entry.family !== "IPv4") return [];
    const address = ipv4Number(entry.address);
    const mask = ipv4Number(entry.netmask);
    if (address === null || mask === null || mask === 0 || !privateAddress(address)) return [];
    const inverse = (~mask) >>> 0;
    if (inverse < 3 || (inverse & (inverse + 1)) !== 0) return [];
    const network = (address & mask) >>> 0;
    const broadcast = (network | inverse) >>> 0;
    return [{ address, mask, network, broadcast }];
  });
}

function dottedAddress(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

// AWTRIX NG answers FIND_AWTRIXNG on port 4211 with hostname[:webPort].
// Discovery is restricted to the configured name on directly connected LANs.
export async function discoverAwtrixHost(host, {
  signal,
  timeoutMs = 1500,
  interfaces = networkInterfaces(),
  socketFactory = createSocket,
} = {}) {
  signal?.throwIfAborted();
  const target = awtrixDiscoveryTarget(host);
  const subnets = subnetList(interfaces);
  if (!target || subnets.length === 0) return null;

  return new Promise((resolve, reject) => {
    let socket;
    let timer;
    let settled = false;
    const candidates = new Set();
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      try { socket?.close(); } catch { /* Binding may not have completed. */ }
      if (error) reject(error);
      else resolve(candidates.size === 1 ? [...candidates][0] : null);
    };
    const abort = () => finish(signal.reason);
    try {
      socket = socketFactory("udp4");
      socket.on("error", () => { candidates.clear(); finish(); });
      socket.on("message", (message, remote) => {
        if (settled || message.length > 128 || remote.port !== 4210) return;
        const reply = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::([0-9]{1,5}))?$/i.exec(message.toString("utf8").trim());
        if (!reply || reply[1].toLowerCase() !== target.hostname || Number(reply[2] || 80) !== target.port) return;
        const address = ipv4Number(remote.address);
        if (address === null || !privateAddress(address) || !subnets.some((subnet) =>
          ((address & subnet.mask) >>> 0) === subnet.network &&
          address !== subnet.network && address !== subnet.broadcast && address !== subnet.address
        )) return;
        candidates.add(`http://${remote.address}${target.port === 80 ? "" : `:${target.port}`}`);
        // Duplicate names are ambiguous; never choose whichever clock replied first.
        if (candidates.size > 1) finish();
      });
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => finish(), timeoutMs);
      socket.bind(4211, "0.0.0.0", () => {
        if (settled) { try { socket.close(); } catch {} return; }
        try {
          socket.setBroadcast(true);
          for (const subnet of subnets) {
            socket.send("FIND_AWTRIXNG", 4210, dottedAddress(subnet.broadcast), () => {});
          }
        } catch { candidates.clear(); finish(); }
      });
    } catch { candidates.clear(); finish(); }
  });
}
