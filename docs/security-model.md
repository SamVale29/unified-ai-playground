# Security model

## Trust boundaries

The browser is untrusted and never receives provider credentials. `apps/gateway` is the local trust boundary: it reads environment variables, validates the experiment, applies timeout and payload limits, redacts secrets and calls the selected provider.

The default bind address is `127.0.0.1`. `ALLOW_REMOTE_ACCESS=true` is not sufficient for a safe public deployment; add authentication and a reviewed network policy before exposing the gateway.

## Data handling

- mock mode makes no network requests;
- history is local and conservative;
- raw payloads are excluded from exports by default;
- share URLs contain configuration only unless the user opts in to prompt content;
- logs contain IDs and metrics, not prompt or response content by default;
- tools are manual and fixture-only; there is no shell or arbitrary code execution.

The provider receives the prompt, files and options necessary for a live experiment. The provider's terms and retention policy apply. Do not run sensitive prompts unless you have reviewed those terms.

## Defensive controls

The gateway applies a request limit, restricted CORS, CSP and related headers, timeout and abort handling, secret redaction, base URL configuration through explicit environment variables and no automatic retries. CI runs lint, typecheck, tests, catalog validation and a repository secret scan.
