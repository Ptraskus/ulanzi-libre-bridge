import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { awtrixDiscoveryTarget, discoverAwtrixHost } from "../src/awtrix-discovery.mjs";

const host = "http://Bedroom-Clock.local";
const interfaces = {
  wifi: [{ family: "IPv4", internal: false, address: "192.168.50.20", netmask: "255.255.255.0" }],
  loopback: [{ family: "IPv4", internal: true, address: "127.0.0.1", netmask: "255.0.0.0" }],
};

class FakeSocket extends EventEmitter {
  constructor(onSend = () => {}) {
    super();
    this.onSend = onSend;
    this.sent = [];
    this.closed = false;
    this.closeCount = 0;
  }

  bind(port, address, callback) {
    this.bound = { port, address };
    queueMicrotask(callback);
  }

  setBroadcast(value) {
    this.broadcast = value;
  }

  send(message, port, address, callback) {
    this.sent.push({ message, port, address });
    callback();
    this.onSend(this);
  }

  reply(message, address = "192.168.50.40", port = 4210) {
    this.emit("message", Buffer.from(message), { address, port });
  }

  close() {
    this.closed = true;
    this.closeCount += 1;
  }
}

function discover(socket, options = {}) {
  return discoverAwtrixHost(host, {
    interfaces,
    timeoutMs: 20,
    socketFactory: (type) => {
      assert.equal(type, "udp4");
      return socket;
    },
    ...options,
  });
}

test("only plain HTTP local hostnames qualify for automatic discovery", () => {
  assert.deepEqual(awtrixDiscoveryTarget(host), { hostname: "bedroom-clock", port: 80 });
  assert.deepEqual(awtrixDiscoveryTarget("http://clock.local:8080"), { hostname: "clock", port: 8080 });
  for (const unsupported of [
    "http://192.168.50.40", "https://clock.local", "http://clock.example.com",
    "http://room.clock.local", "http://user:password@clock.local", "http://-clock.local",
  ]) {
    assert.equal(awtrixDiscoveryTarget(unsupported), null, unsupported);
  }
});

test("discovery waits past unrelated replies and uses the matching device address", async () => {
  const socket = new FakeSocket((self) => {
    self.reply("another-clock", "192.168.50.41");
    self.reply("BEDROOM-CLOCK");
    self.reply("bedroom-clock");
  });
  assert.equal(await discover(socket), "http://192.168.50.40");
  assert.deepEqual(socket.bound, { port: 4211, address: "0.0.0.0" });
  assert.equal(socket.broadcast, true);
  assert.deepEqual(socket.sent, [{ message: "FIND_AWTRIXNG", port: 4210, address: "192.168.50.255" }]);
  assert.equal(socket.closeCount, 1);
});

test("matching replies preserve the explicitly configured HTTP port", async () => {
  const customPortSocket = new FakeSocket((self) => {
    self.reply("bedroom-clock");
    self.reply("bedroom-clock:8081");
    self.reply("bedroom-clock:8080");
  });
  assert.equal(await discoverAwtrixHost(`${host}:8080`, {
    interfaces, timeoutMs: 20, socketFactory: () => customPortSocket,
  }), "http://192.168.50.40:8080");
  assert.equal(customPortSocket.closeCount, 1);
});

test("ambiguous matching names on different devices never select a clock", async () => {
  const socket = new FakeSocket((self) => {
    self.reply("bedroom-clock", "192.168.50.40");
    self.reply("bedroom-clock", "192.168.50.41");
  });
  assert.equal(await discover(socket), null);
  assert.equal(socket.closeCount, 1);
});

test("malformed packets and peers outside the connected LAN cannot become candidates", async () => {
  const socket = new FakeSocket((self) => {
    for (const message of [
      "http://bedroom-clock", "bedroom-clock.local", "bedroom-clock:0", "bedroom-clock:65536",
      "bedroom-clock/path", "bedroom-clock\0", "bedroom-clock\nother", "x".repeat(129),
    ]) self.reply(message);
    self.reply(Buffer.from("bedroom-clock", "ascii").map((byte) => byte | 0x80));
    self.reply("bedroom-clock", "192.168.50.40", 4211);
    for (const address of [
      "127.0.0.1", "8.8.8.8", "224.0.0.1", "255.255.255.255", "192.168.50.0",
      "192.168.50.255", "192.168.50.20", "192.168.51.40", "192.168.50.999", "::1",
    ]) self.reply("bedroom-clock", address);
  });
  assert.equal(await discover(socket), null);
  assert.equal(socket.closeCount, 1);
});

test("an empty discovery window resolves without a clock and releases the UDP port", async () => {
  const socket = new FakeSocket();
  assert.equal(await discover(socket), null);
  assert.equal(socket.closeCount, 1);
  socket.reply("bedroom-clock");
  assert.equal(socket.closeCount, 1);
});

test("socket failures discard previously received candidates and release the UDP port", async () => {
  const socket = new FakeSocket((self) => {
    self.reply("bedroom-clock");
    self.emit("error", new Error("network is unavailable"));
  });
  assert.equal(await discover(socket), null);
  assert.equal(socket.closeCount, 1);

  const busySocket = new FakeSocket();
  busySocket.bind = () => { throw Object.assign(new Error("port occupied"), { code: "EADDRINUSE" }); };
  assert.equal(await discover(busySocket), null);
  assert.equal(busySocket.closeCount, 1);
});

test("cancellation during discovery rejects promptly and closes the socket", async () => {
  const controller = new AbortController();
  const socket = new FakeSocket(() => controller.abort());
  await assert.rejects(discover(socket, { signal: controller.signal, timeoutMs: 60_000 }), {
    name: "AbortError",
  });
  assert.equal(socket.closeCount, 1);
});

test("an already cancelled discovery never creates a socket", async () => {
  const controller = new AbortController();
  controller.abort();
  let created = false;
  await assert.rejects(discoverAwtrixHost(host, {
    interfaces, signal: controller.signal,
    socketFactory: () => { created = true; throw new Error("must not create socket"); },
  }), { name: "AbortError" });
  assert.equal(created, false);
});

test("discovery does not open a socket without an eligible connected LAN", async () => {
  for (const absentInterfaces of [
    {}, { loopback: interfaces.loopback },
    { public: [{ family: "IPv4", internal: false, address: "8.8.8.8", netmask: "255.255.255.0" }] },
    { ipv6: [{ family: "IPv6", internal: false, address: "fe80::1", netmask: "ffff:ffff::" }] },
  ]) {
    let created = false;
    assert.equal(await discoverAwtrixHost(host, {
      interfaces: absentInterfaces,
      socketFactory: () => { created = true; return new FakeSocket(); },
    }), null);
    assert.equal(created, false);
  }
});
