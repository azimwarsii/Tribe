process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";

import test from "node:test";
import assert from "node:assert/strict";

const { startOrderStream } = await import("./stream.js");

/** Behaves like the real thing where it hurt: close() on a failed connection fires the error handler again. */
class FakeSocket {
  static last: FakeSocket;
  onopen?: () => void; onmessage?: (e: { data: string }) => void; onclose?: () => void; onerror?: () => void;
  closes = 0;
  constructor() { FakeSocket.last = this; }
  send() {}
  close() { if (++this.closes > 50) throw new RangeError("Maximum call stack size exceeded"); this.onerror?.(); }
}

test("a stream that errors or sends junk can't take the server down", () => {
  const real = globalThis.WebSocket, log = console.error;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  console.error = () => {};
  const stop = startOrderStream();
  try {
    const ws = FakeSocket.last;
    assert.doesNotThrow(() => ws.onerror!());
    assert.equal(ws.closes, 0);
    assert.doesNotThrow(() => ws.onmessage!({ data: "not json" }));
  } finally {
    FakeSocket.last.onerror = undefined;
    stop();
    globalThis.WebSocket = real;
    console.error = log;
  }
});
