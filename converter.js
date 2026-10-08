/**
 * Local desk rate converter. No network calls.
 * Rates are units of quote currency per 1 unit of base currency.
 */

const MAX_INPUT_LENGTH = 32;
const MAX_AMOUNT = 1000000000;

const RATES = Object.freeze({
  NGN: 1,
  USD: 1550,
  GBP: 1980,
  EUR: 1680,
  GHS: 120,
});

const SUPPORTED = Object.keys(RATES);

class ConversionError extends Error {
  constructor(code, userMessage, logDetail) {
    super(userMessage);
    this.name = "ConversionError";
    this.code = code;
    this.userMessage = userMessage;
    this.logDetail = logDetail;
  }
}

function logFailure(error, rawInput) {
  const entry = {
    level: "warn",
    event: "conversion_rejected",
    code: error.code || "UNEXPECTED",
    message: error.userMessage || "Request could not be completed.",
    detail: error.logDetail || error.message,
    inputShape: describeInput(rawInput),
    at: new Date().toISOString(),
  };
  if (typeof console !== "undefined" && console.warn) {
    console.warn(JSON.stringify(entry));
  }
  return entry;
}

function describeInput(rawInput) {
  if (rawInput === null) return "null";
  if (Array.isArray(rawInput)) return "array";
  return typeof rawInput;
}

function fail(code, userMessage, logDetail) {
  throw new ConversionError(code, userMessage, logDetail);
}

function normalizeCode(value, label) {
  if (value === undefined || value === null) {
    fail(
      "MISSING_CURRENCY",
      "Enter a " + label + " currency code, for example NGN or USD.",
      label + " was " + (value === null ? "null" : "undefined")
    );
  }
  if (typeof value !== "string") {
    fail(
      "UNEXPECTED_TYPE",
      label[0].toUpperCase() + label.slice(1) + " currency must be text such as NGN, not a " + describeInput(value) + ".",
      label + " type was " + describeInput(value)
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(
      "EMPTY_CURRENCY",
      "The " + label + " currency is empty. Use one of: " + SUPPORTED.join(", ") + ".",
      label + " was blank after trim"
    );
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    fail(
      "INPUT_TOO_LONG",
      label[0].toUpperCase() + label.slice(1) + " currency is too long. Use a 3-letter code such as NGN.",
      label + " length " + trimmed.length + " exceeded " + MAX_INPUT_LENGTH
    );
  }
  const code = trimmed.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    fail(
      "INVALID_CURRENCY_FORMAT",
      "\"" + trimmed.slice(0, 12) + "\" is not a currency code. Use three letters, for example USD.",
      label + " failed format check"
    );
  }
  if (!Object.prototype.hasOwnProperty.call(RATES, code)) {
    fail(
      "UNKNOWN_CURRENCY",
      code + " is not in the desk table. Supported codes: " + SUPPORTED.join(", ") + ".",
      label + " code not in local table"
    );
  }
  return code;
}

function normalizeAmount(value) {
  if (value === undefined || value === null) {
    fail(
      "MISSING_AMOUNT",
      "Enter an amount to convert.",
      "amount was " + (value === null ? "null" : "undefined")
    );
  }
  if (typeof value === "boolean" || Array.isArray(value) || (typeof value === "object" && value !== null)) {
    fail(
      "UNEXPECTED_TYPE",
      "Amount must be a number or numeric text, not a list or object.",
      "amount type was " + describeInput(value)
    );
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(
        "INVALID_AMOUNT",
        "Amount must be a finite number. Infinity and NaN are not accepted.",
        "amount was non-finite number"
      );
    }
    return checkRange(value);
  }
  if (typeof value !== "string") {
    fail(
      "UNEXPECTED_TYPE",
      "Amount must be a number or numeric text.",
      "amount type was " + describeInput(value)
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    fail(
      "EMPTY_AMOUNT",
      "Amount is empty. Enter a positive number, for example 25000.",
      "amount was blank after trim"
    );
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    fail(
      "INPUT_TOO_LONG",
      "Amount is too long (max " + MAX_INPUT_LENGTH + " characters). Enter a smaller number.",
      "amount length " + trimmed.length
    );
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    fail(
      "INVALID_AMOUNT",
      "Amount must be a positive number with at most 2 decimal places. Example: 1500.50",
      "amount failed numeric pattern"
    );
  }
  return checkRange(Number(trimmed));
}

function checkRange(amount) {
  if (amount <= 0) {
    fail(
      "NON_POSITIVE_AMOUNT",
      "Amount must be greater than zero.",
      "amount was " + amount
    );
  }
  if (amount > MAX_AMOUNT) {
    fail(
      "AMOUNT_TOO_LARGE",
      "Amount is above the desk limit of " + MAX_AMOUNT.toLocaleString("en-US") + ".",
      "amount exceeded local cap"
    );
  }
  return amount;
}

function convertCurrency(input) {
  if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
    const error = new ConversionError(
      "UNEXPECTED_TYPE",
      "Send amount, from, and to together. Example: 100 NGN to USD.",
      "payload type was " + describeInput(input)
    );
    logFailure(error, input);
    throw error;
  }

  try {
    const amount = normalizeAmount(input.amount);
    const from = normalizeCode(input.from, "source");
    const to = normalizeCode(input.to, "target");
    if (from === to) {
      fail(
        "SAME_CURRENCY",
        "Source and target are the same. Pick a different target currency.",
        "from and to matched"
      );
    }
    const ngn = amount * RATES[from];
    const converted = ngn / RATES[to];
    const result = Math.round(converted * 100) / 100;
    return {
      ok: true,
      amount: amount,
      from: from,
      to: to,
      result: result,
      rateNote: "Fixed local desk table. Not a live market rate.",
    };
  } catch (error) {
    if (error instanceof ConversionError) {
      logFailure(error, input);
      throw error;
    }
    const wrapped = new ConversionError(
      "UNEXPECTED",
      "We could not convert that request. Check the amount and currency codes, then try again.",
      "non-conversion error escaped the validator"
    );
    logFailure(wrapped, input);
    throw wrapped;
  }
}

function handleUserRequest(input) {
  try {
    const value = convertCurrency(input);
    return { ok: true, userMessage: formatSuccess(value), result: value };
  } catch (error) {
    return {
      ok: false,
      userMessage: error.userMessage || "We could not convert that request. Check the amount and currency codes.",
      code: error.code || "UNEXPECTED",
    };
  }
}

function formatSuccess(value) {
  return value.amount + " " + value.from + " = " + value.result + " " + value.to + ". Fixed desk rate, not a live quote.";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RATES: RATES,
    SUPPORTED: SUPPORTED,
    MAX_INPUT_LENGTH: MAX_INPUT_LENGTH,
    ConversionError: ConversionError,
    convertCurrency: convertCurrency,
    handleUserRequest: handleUserRequest,
    logFailure: logFailure,
  };
}
