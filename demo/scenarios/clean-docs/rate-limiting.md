# API Rate Limiting (Token Bucket)

This note describes a planned rate-limiting layer for the public API. The goal
is to protect upstream services from bursts while still allowing short spikes
of legitimate traffic.

## How it works

Each API key gets its own token bucket. A bucket holds up to `burst` tokens and
refills at a steady `refillRate` (tokens per second). Every request consumes one
token; if the bucket is empty the request is rejected with `429 Too Many
Requests` and a `Retry-After` header.

Because the bucket can store unused capacity, a client that has been idle can
make a short burst of requests without being throttled — the refill rate only
caps the *sustained* throughput.

## Configuration

| Key                 | Default | Description                                  |
| ------------------- | ------- | -------------------------------------------- |
| `burst`             | `100`   | Maximum tokens a bucket can hold.            |
| `refillRate`        | `20`    | Tokens added per second.                      |
| `keyBy`             | `apiKey`| Identity used to scope a bucket.             |

## Usage example

```ts
// Sustained ~20 req/s, tolerating bursts up to 100.
const limiter = createRateLimiter({ burst: 100, refillRate: 20, keyBy: "apiKey" });
```

When `burst` and `refillRate` are equal, the limiter behaves like a simple
fixed-rate limiter with no burst allowance.
