const assert = require("assert");
const { handleUserRequest, convertCurrency, ConversionError } = require("./converter");

const cases = [
  {
    name: "empty amount",
    input: { amount: "", from: "NGN", to: "USD" },
    code: "EMPTY_AMOUNT",
    sees: /empty/i,
  },
  {
    name: "empty currency",
    input: { amount: "100", from: "   ", to: "USD" },
    code: "EMPTY_CURRENCY",
    sees: /empty/i,
  },
  {
    name: "very long amount",
    input: { amount: "1".repeat(40), from: "NGN", to: "USD" },
    code: "INPUT_TOO_LONG",
    sees: /too long/i,
  },
  {
    name: "very long currency",
    input: { amount: "10", from: "N".repeat(40), to: "USD" },
    code: "INPUT_TOO_LONG",
    sees: /too long/i,
  },
  {
    name: "unexpected type object amount",
    input: { amount: { value: 10 }, from: "NGN", to: "USD" },
    code: "UNEXPECTED_TYPE",
    sees: /number or numeric text/i,
  },
  {
    name: "unexpected type array payload",
    input: ["100", "NGN", "USD"],
    code: "UNEXPECTED_TYPE",
    sees: /amount, from, and to/i,
  },
  {
    name: "unexpected type boolean amount",
    input: { amount: true, from: "NGN", to: "USD" },
    code: "UNEXPECTED_TYPE",
    sees: /number or numeric text/i,
  },
  {
    name: "unknown currency",
    input: { amount: "50", from: "NGN", to: "XYZ" },
    code: "UNKNOWN_CURRENCY",
    sees: /not in the desk table/i,
  },
  {
    name: "negative amount",
    input: { amount: "-20", from: "USD", to: "NGN" },
    code: "INVALID_AMOUNT",
    sees: /positive number/i,
  },
  {
    name: "missing amount",
    input: { from: "GBP", to: "NGN" },
    code: "MISSING_AMOUNT",
    sees: /enter an amount/i,
  },
];

let failed = 0;
for (const testCase of cases) {
  const response = handleUserRequest(testCase.input);
  try {
    assert.strictEqual(response.ok, false, testCase.name + " should fail");
    assert.strictEqual(response.code, testCase.code, testCase.name + " code");
    assert.match(response.userMessage, testCase.sees, testCase.name + " user message");
    assert.doesNotMatch(response.userMessage, /stack|TypeError|at converter/i, testCase.name + " leaks internals");
    assert.throws(() => convertCurrency(testCase.input), ConversionError);
    console.log("PASS  " + testCase.name + " -> " + response.userMessage);
  } catch (error) {
    failed += 1;
    console.error("FAIL  " + testCase.name + ": " + error.message);
  }
}

const ok = handleUserRequest({ amount: "100", from: "usd", to: "ngn" });
try {
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.result.result, 155000);
  console.log("PASS  happy path -> " + ok.userMessage);
} catch (error) {
  failed += 1;
  console.error("FAIL  happy path: " + error.message);
}

if (failed > 0) {
  console.error(failed + " test(s) failed");
  process.exit(1);
}
console.log("All " + (cases.length + 1) + " checks passed");
