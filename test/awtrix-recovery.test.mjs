import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { AwtrixClient } from "../src/awtrix-client.mjs";
import { BridgeError } from "../src/errors.mjs";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function config(awtrix = {}) {
  return {
    requestTimeoutMs: 1_000,
    displayDurationSeconds: 10,
    awtrix: {
      host: "http://bedroom-clock.local", api: "auto", appName: "glucose",
      username: "test-user", password: "TEST_ONLY_PASSWORD", activateOnUpdate: true,
      ...awtrix,
    },
  };
}

const state = {
  kind: "in-range", text: "112 -", trend: "flat", textColor: "#00D26A",
  lifetimeMs: 600_000, ageMs: 60_000,
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function networkFailure() {
  return new TypeError("fetch failed");
}

function device(hostname = "bedroom-clock") {
  return { hostname, boardType: "awtrixng", uid: "TEST_ONLY_DEVICE_ID" };
}

test("a DNS failure recovers the configured clock before any display write", async () => {
  const currentConfig = config();
  const calls = [];
  let discoveries = 0;
  const client = new AwtrixClient(currentConfig, {
    discoverHost: async (host) => {
      assert.equal(host, currentConfig.awtrix.host);
      discoveries += 1;
      return "http://192.168.50.40";
    },
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    if (url.hostname.endsWith(".local")) throw networkFailure();
    return response(device("BEDROOM-CLOCK"));
  };
  assert.equal(await client.prepareConnection(), "ng");
  assert.equal(discoveries, 1);
  assert.equal(client.host, "http://192.168.50.40");
  assert.equal(currentConfig.awtrix.host, "http://bedroom-clock.local");
  assert.deepEqual(calls.map(({ url }) => url.pathname), ["/api/v1/version", "/api/v1/device"]);
  assert.ok(calls.every(({ options }) => options.method === "GET"));

  await client.push(state);
  assert.deepEqual(calls.slice(2).map(({ url, options }) => [url.hostname, url.pathname, options.method]), [
    ["192.168.50.40", "/api/v1/apps/pushed/glucose", "PUT"],
    ["192.168.50.40", "/api/v1/apps/active", "PUT"],
  ]);
});

test("successive DHCP changes are rediscovered without reusing the previous IP or changing configuration", async () => {
  const addresses = ["http://192.168.50.40", "http://192.168.50.42"];
  const currentConfig = config();
  const calls = [];
  const client = new AwtrixClient(currentConfig, { discoverHost: async () => addresses.shift() });
  globalThis.fetch = async (url, options) => {
    calls.push({ hostname: url.hostname, method: options.method });
    if (url.hostname.endsWith(".local")) throw networkFailure();
    return response(device());
  };
  await client.prepareConnection();
  await client.push(state);
  const firstCycleCalls = calls.length;
  await client.prepareConnection();
  await client.push(state);
  assert.equal(client.host, "http://192.168.50.42");
  assert.equal(currentConfig.awtrix.host, "http://bedroom-clock.local");
  assert.ok(calls.slice(firstCycleCalls).every(({ hostname }) => hostname !== "192.168.50.40"));
  assert.equal(addresses.length, 0);
});

test("a recovered client returns to the configured hostname when name resolution recovers", async () => {
  let dnsAvailable = false;
  let discoveries = 0;
  const client = new AwtrixClient(config(), {
    discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
  });
  globalThis.fetch = async (url) => {
    if (url.hostname.endsWith(".local") && !dnsAvailable) throw networkFailure();
    return response(url.pathname === "/api/v1/device" ? device() : { version: "1.1.0" });
  };
  await client.prepareConnection();
  dnsAvailable = true;
  await client.prepareConnection();
  assert.equal(client.host, "http://bedroom-clock.local");
  assert.equal(discoveries, 1);
});

test("an explicit NG mode recovers after the first failed write without replaying that write", async () => {
  const calls = [];
  let discoveries = 0;
  const client = new AwtrixClient(config({ api: "ng" }), {
    discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ pathname: url.pathname, method: options.method });
    if (url.hostname.endsWith(".local")) throw networkFailure();
    return response(device());
  };
  await client.prepareConnection();
  await assert.rejects(client.push(state), (error) => {
    client.noteConnectionFailure(error);
    return error.code === "HTTP_NETWORK";
  });
  assert.equal(discoveries, 0);
  assert.equal(calls.filter(({ method }) => method === "PUT").length, 1);
  await client.prepareConnection();
  assert.equal(client.host, "http://192.168.50.40");
  assert.equal(discoveries, 1);
  assert.equal(calls.filter(({ method }) => method === "PUT").length, 1);
});

test("an ambiguous audio failure is not replayed or followed by discovery", async () => {
  let writes = 0;
  let discoveries = 0;
  const client = new AwtrixClient(config({ api: "ng" }), {
    discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
  });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, "POST");
    writes += 1;
    throw networkFailure();
  };
  await assert.rejects(client.playGlucoseAlarm("low"), { code: "HTTP_NETWORK" });
  assert.equal(writes, 1);
  assert.equal(discoveries, 0);
});

test("authentication errors never trigger automatic discovery", async () => {
  let discoveries = 0;
  const client = new AwtrixClient(config(), {
    discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
  });
  globalThis.fetch = async () => response({ error: "unauthorized" }, 401);
  await assert.rejects(client.prepareConnection(), { code: "AWTRIX_UNAUTHORIZED" });
  assert.equal(discoveries, 0);
  assert.equal(client.host, "http://bedroom-clock.local");
});

test("an already cancelled request never triggers automatic discovery", async () => {
  const controller = new AbortController();
  controller.abort();
  let discoveries = 0;
  const client = new AwtrixClient(config(), {
    discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
  });
  globalThis.fetch = async (_url, options) => {
    options.signal.throwIfAborted();
    throw new Error("a cancelled request must not reach this point");
  };
  await assert.rejects(client.prepareConnection(controller.signal), { code: "HTTP_ABORTED" });
  assert.equal(discoveries, 0);
});

test("cancellation during discovery stops recovery before contacting a candidate", async () => {
  const controller = new AbortController();
  const calls = [];
  const client = new AwtrixClient(config(), {
    discoverHost: async (_host, { signal }) => {
      controller.abort();
      signal.throwIfAborted();
    },
  });
  globalThis.fetch = async (url) => {
    calls.push(url.hostname);
    throw networkFailure();
  };
  await assert.rejects(client.prepareConnection(controller.signal), { code: "HTTP_ABORTED" });
  assert.deepEqual(calls, ["bedroom-clock.local"]);
  assert.equal(client.host, "http://bedroom-clock.local");
});

test("a timed out connection may recover without repeating the timed out request", async () => {
  const calls = [];
  const client = new AwtrixClient(config(), { discoverHost: async () => "http://192.168.50.40" });
  globalThis.fetch = async (url) => {
    calls.push(url.pathname);
    if (url.hostname.endsWith(".local")) throw new DOMException("request timed out", "TimeoutError");
    return response(device());
  };
  assert.equal(await client.prepareConnection(), "ng");
  assert.deepEqual(calls, ["/api/v1/version", "/api/v1/device"]);
});

test("legacy firmware and nonlocal destinations never trigger automatic discovery", async () => {
  for (const awtrix of [
    { api: "3" }, { host: "http://192.168.50.40" },
    { host: "http://clock.example.test" }, { host: "https://bedroom-clock.local" },
  ]) {
    let discoveries = 0;
    const client = new AwtrixClient(config(awtrix), {
      discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
    });
    globalThis.fetch = async () => { throw networkFailure(); };
    if (awtrix.api === "3") {
      assert.equal(await client.prepareConnection(), "3");
      await assert.rejects(client.push(state), { code: "HTTP_NETWORK" });
      client.noteConnectionFailure(new BridgeError("connection lost", { code: "HTTP_NETWORK" }));
      assert.equal(await client.prepareConnection(), "3");
    } else {
      await assert.rejects(client.prepareConnection(), { code: "HTTP_NETWORK" });
    }
    assert.equal(discoveries, 0);
  }
});

test("unavailable discovery preserves the retryable connection failure", async () => {
  for (const discoverHost of [
    async () => null,
    async () => { throw new Error("port occupied"); },
  ]) {
    const client = new AwtrixClient(config(), { discoverHost });
    globalThis.fetch = async () => { throw networkFailure(); };
    await assert.rejects(client.prepareConnection(), (error) => error.code === "HTTP_NETWORK" && error.retryable);
    assert.equal(client.host, "http://bedroom-clock.local");
  }
});

test("a discovered endpoint is not adopted unless the device confirms its hostname and firmware", async () => {
  for (const reportedDevice of [
    device("other-clock"), { ...device(), boardType: "unrelated" }, {}, null, device(7),
  ]) {
    const client = new AwtrixClient(config(), { discoverHost: async () => "http://192.168.50.40" });
    globalThis.fetch = async (url) => {
      if (url.hostname.endsWith(".local")) throw networkFailure();
      return response(reportedDevice);
    };
    await assert.rejects(client.prepareConnection(), { code: "HTTP_NETWORK" });
    assert.equal(client.host, "http://bedroom-clock.local");
  }
});

test("HTTP responses other than connection failures do not trigger discovery", async () => {
  for (const status of [302, 403, 404, 503]) {
    let discoveries = 0;
    const client = new AwtrixClient(config(), {
      discoverHost: async () => { discoveries += 1; return "http://192.168.50.40"; },
    });
    globalThis.fetch = async () => response({}, status);
    await assert.rejects(client.prepareConnection());
    assert.equal(discoveries, 0);
  }
});
