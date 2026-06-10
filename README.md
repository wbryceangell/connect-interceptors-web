# ConnectRPC Interceptors (Web)

A library of interceptors for [ConnectRPC](https://connectrpc.com) browser clients.

## Interceptors

- `createRetryInterceptor` — Retries unary RPCs that fail with configurable error conditions.
  - Supports custom backoff strategies and custom functions for determining whether to retry.
  - Defaults to a 1 second backoff, 10 retry maximum, and automatic retries on `Code.Unavailable`.
  - Streaming RPCs pass through without retry (unary only).

## Installation

```sh
npm install connect-interceptors-web @connectrpc/connect @connectrpc/connect-web
```

## Usage

Read more about ConnectRPC web interceptors [here](https://connectrpc.com/docs/web/interceptors).

```ts
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { createRetryInterceptor } from "connect-interceptors-web";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
  interceptors: [createRetryInterceptor()],
});

const client = createPromiseClient(GreetService, transport);
```

### Custom configuration

```ts
import {
  Code,
  ConnectError,
  createPromiseClient,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  createRetryInterceptor,
  expBackoffGenerator,
} from "connect-interceptors-web";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
  interceptors: [
    createRetryInterceptor(console, {
      maxAttempts: 5,
      backoffGenerator: expBackoffGenerator(),
      isRetryable: (err) => {
        const code = ConnectError.from(err).code;
        return code === Code.Unavailable || code === Code.Unknown;
      },
    }),
  ],
});

const client = createPromiseClient(GreetService, transport);
```

## Browser network errors

Raw `fetch` network failures in browsers often surface as `Code.Unknown` rather than `Code.Unavailable`. The default `isRetryable` only retries `Code.Unavailable`. If you want to retry ambiguous browser network errors, provide a custom `isRetryable` as shown above.

See [connect-es #836](https://github.com/connectrpc/connect-es/issues/836) for background.

## API

| Export | Description |
| --- | --- |
| `createRetryInterceptor(logger?, config?)` | Creates a Connect `Interceptor` |
| `defaultRetryConfig()` | Default config: 1s fixed backoff, 10 max attempts |
| `defaultIsRetryable(err)` | Returns true for `Code.Unavailable` |
| `fixedBackoff()` | Returns 1000ms |
| `fixedBackoffGenerator()` | Factory for fixed backoff |
| `expBackoffGenerator(options?)` | Factory for exponential backoff (15s max interval) |
| `BACKOFF_STOP` | Sentinel value (`-1`) to stop retrying |

## Development

```sh
npm install
npm test
npm build
```
