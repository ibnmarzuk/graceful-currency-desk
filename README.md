# Desk rate converter

Small local currency converter for the ORBIT task "Handle errors like the user is watching."

It takes an amount and two currency codes, then calls `convertCurrency`. Rates come from a fixed table in `converter.js`. There is no network call and no live FX service.

Open `index.html` in a browser, or run the tests with Node.

## Run

```bash
node test.js
```

## What the user sees vs what is logged

User messages name the problem and the next step. They do not include stack traces, file paths, or internal type dumps. Logs are structured warnings with a stable code, a short detail, and the shape of the input (string, object, array, null), not the raw value when that value could be huge.

| Failure case | Example input | What the user sees | What is logged |
| --- | --- | --- | --- |
| Empty amount | amount `""` | Amount is empty. Enter a positive number, for example 25000. | `EMPTY_AMOUNT`, detail: amount was blank after trim |
| Empty currency | from `"   "` | The source currency is empty. Use one of: NGN, USD, GBP, EUR, GHS. | `EMPTY_CURRENCY`, detail: source was blank after trim |
| Very long amount | 40-digit string | Amount is too long (max 32 characters). Enter a smaller number. | `INPUT_TOO_LONG`, detail: amount length |
| Very long currency | 40-letter code | Source currency is too long. Use a 3-letter code such as NGN. | `INPUT_TOO_LONG`, detail: source length exceeded 32 |
| Unexpected type (amount object) | amount `{ value: 10 }` | Amount must be a number or numeric text, not a list or object. | `UNEXPECTED_TYPE`, detail: amount type was object |
| Unexpected type (array payload) | `["100","NGN","USD"]` | Send amount, from, and to together. Example: 100 NGN to USD. | `UNEXPECTED_TYPE`, detail: payload type was array |
| Unexpected type (boolean) | amount `true` | Amount must be a number or numeric text, not a list or object. | `UNEXPECTED_TYPE`, detail: amount type was boolean |
| Unknown currency | to `XYZ` | XYZ is not in the desk table. Supported codes: NGN, USD, GBP, EUR, GHS. | `UNKNOWN_CURRENCY`, detail: target code not in local table |
| Invalid / negative amount | amount `-20` | Amount must be a positive number with at most 2 decimal places. Example: 1500.50 | `INVALID_AMOUNT`, detail: amount failed numeric pattern |
| Missing amount | no amount field | Enter an amount to convert. | `MISSING_AMOUNT`, detail: amount was undefined |

Happy path: `100 USD` to `NGN` returns `155000`, with the note that the figure is a fixed desk rate.

## Tests

`test.js` covers each failure case above, checks that the user message matches the intended guidance, and checks that the message does not leak a stack or `TypeError`. It also checks one successful conversion.

## Desk table

Units of NGN per 1 unit of the named currency: NGN 1, USD 1550, GBP 1980, EUR 1680, GHS 120. These are placeholders for the exercise, not market quotes.
