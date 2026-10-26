import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AwtrixClient } from "../src/awtrix-client.mjs";
import { run } from "../src/index.mjs";

test("runtime rebuilds an expired reading after discovery instead of sending stale glucose", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ulanzi-recovery-cycle-"));
  const cwd = process.cwd();
  const environment = { ...process.env };
  const OriginalDate = globalThis.Date;
  let now = OriginalDate.parse("2026-01-01T12:00:00Z");
  const writes = [];
  const prepare = AwtrixClient.prototype.prepareConnection;
  try {
    process.chdir(directory);
    Object.assign(process.env, {
      APP_LANGUAGE: "en", GLUCOSE_SOURCE: "mock", AWTRIX_HOST: "http://my-clock.local",
      AWTRIX_API: "auto", AWTRIX_USERNAME: "", AWTRIX_PASSWORD: "",
      GLUCOSE_ALARM_ENABLED: "false", SENSOR_LIFETIME_DAYS: "0",
      STALE_AFTER_MINUTES: "2", REQUEST_TIMEOUT_SECONDS: "2",
      MOCK_AGE_MINUTES: "1.8", LOG_LEVEL: "error",
      ULANZI_STATUS_FILE: "", ULANZI_STOP_FILE: "", ULANZI_COMMAND_FILE: "",
    });
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    };
    t.mock.method(AwtrixClient.prototype, "prepareConnection", async function (signal) {
      this.discoverHost = async () => "http://192.168.50.40";
      return prepare.call(this, signal);
    });
    t.mock.method(globalThis, "fetch", async (url, options) => {
      if (new URL(url).hostname === "my-clock.local") throw new TypeError("fetch failed");
      if (new URL(url).pathname === "/api/v1/device") {
        now += 15_000;
        return Response.json({ boardType: "awtrixng", hostname: "my-clock" });
      }
      writes.push({ path: new URL(url).pathname, body: JSON.parse(options.body) });
      return Response.json({ ok: true });
    });
    assert.equal(await run(["--source=mock", "--once"]), 0);
    const display = writes.filter(({ path }) => path.includes("/apps/pushed/"));
    assert.equal(display.length, 1);
    assert.equal(display[0].body.text, "NO DATA");
    assert.equal(display[0].body.draw, undefined);
  } finally {
    globalThis.Date = OriginalDate;
    process.chdir(cwd);
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
    await rm(directory, { recursive: true, force: true });
  }
});
