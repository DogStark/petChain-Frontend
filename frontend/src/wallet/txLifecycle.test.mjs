import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPollResult,
  createTracker,
  deserializeTracker,
  isTerminal,
  markCancelled,
  markReplaced,
  serializeTracker,
  shouldPoll,
} from "../src/wallet/txLifecycle.js";

test("distinct lifecycle states and terminal detection", () => {
  const t = createTracker("abc");
  assert.equal(t.state, "pending");
  assert.equal(shouldPoll(t), true);
  const confirmed = applyPollResult(t, { status: "success", hash: "abc" });
  assert.equal(confirmed.state, "confirmed");
  assert.equal(isTerminal(confirmed.state), true);
  assert.equal(shouldPoll(confirmed), false);
});

test("polling stops at terminal and ignores duplicate late polls", () => {
  let t = createTracker("h1");
  t = applyPollResult(t, { status: "pending" });
  assert.equal(t.state, "submitted");
  t = applyPollResult(t, { status: "success", hash: "h1" });
  const late = applyPollResult(t, { status: "failed", hash: "h1" });
  assert.equal(late.state, "confirmed");
  assert.equal(late.history.length, t.history.length);
});

test("replacement is not mistaken for a second user action", () => {
  let t = createTracker("orig");
  t = applyPollResult(t, { status: "pending" });
  t = markReplaced(t, "repl");
  assert.equal(t.replacesHash, "orig");
  assert.equal(t.displayHash, "repl");
  assert.equal(t.state, "submitted");
  assert.ok(t.history.some((e) => e.state === "replaced" && e.hash === "orig"));
  assert.ok(t.history.some((e) => e.note === "replacement submitted"));
});

test("cancellation is terminal and preserves audit history", () => {
  let t = createTracker("orig");
  t = applyPollResult(t, { status: "pending" });
  t = markCancelled(t);
  assert.equal(t.state, "cancelled");
  assert.equal(shouldPoll(t), false);
  assert.ok(t.history.length >= 2);
});

test("reload-safe serialize/deserialize resumes polling correctly", () => {
  let t = createTracker("orig");
  t = applyPollResult(t, { status: "pending" });
  const raw = serializeTracker(t);
  const restored = deserializeTracker(raw);
  assert.equal(restored.state, "submitted");
  assert.equal(shouldPoll(restored), true);
  const done = applyPollResult(restored, { status: "success", hash: "orig" });
  assert.equal(done.displayHash, "orig");
});

test("network failure while pending does not flip to a false terminal", () => {
  let t = createTracker("orig");
  t = applyPollResult(t, { status: "pending" });
  const after = applyPollResult(t, { status: "network_error" });
  assert.equal(after.state, "submitted");
  assert.equal(shouldPoll(after), true);
});
