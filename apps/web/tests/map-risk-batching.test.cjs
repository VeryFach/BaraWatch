const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadRepository(request) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/modules/risk/repo.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", js)(
    () => ({ supabaseRequest: request }),
    module,
    module.exports,
  );
  return module.exports;
}
const ids = Array.from(
  { length: 884 },
  (_, i) => `a1000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

test("884 region IDs are fetched completely with short URLs and bounded concurrency", async () => {
  let active = 0,
    peak = 0,
    requests = 0;
  const repo = loadRepository(async (url) => {
    requests++;
    assert.ok(url.length < 2100);
    const group = url.match(/region_id=in\.\(([^)]+)\)/)[1].split(",");
    assert.ok(group.length <= 50);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return group.map((region_id) => ({ region_id }));
  });
  const data = await repo.getRiskScoresByRegionIds([...ids, ids[0]]);
  assert.equal(requests, 18);
  assert.ok(peak <= 4);
  assert.deepEqual(
    data.map((row) => row.region_id),
    ids,
  );
});

test("a failed risk batch rejects the result instead of returning partial data", async () => {
  const repo = loadRepository(async () => {
    throw new Error("database unavailable");
  });
  await assert.rejects(
    repo.getRiskScoresByRegionIds([...ids, ids[0]]),
    /database unavailable/,
  );
});

test("empty region selection does not query all risks", async () => {
  const repo = loadRepository(async () => {
    throw Error("unexpected query");
  });
  assert.deepEqual(await repo.getRiskScoresByRegionIds([]), []);
});
test("legacy request without IDs remains unfiltered", async () => {
  const repo = loadRepository(async (url) => {
    assert.equal(url.includes("region_id=in."), false);
    return [{ region_id: "example" }];
  });
  assert.deepEqual(await repo.getRiskScoresByRegionIds(null), [
    { region_id: "example" },
  ]);
});

test("region filter values retain URL encoding", async () => {
  const repo = loadRepository(async (url) => {
    assert.ok(url.includes("example%26extra%3Dvalue"));
    assert.equal(url.includes("&extra=value"), false);
    return [];
  });
  await repo.getRiskScoresByRegionIds(["example&extra=value"]);
});
