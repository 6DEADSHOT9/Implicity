# S3: Does self-hosted PostHog include Endpoints, manageable through the API?

**Type:** spike. **Time box:** half a day. **Blocks:** T1 and everything after it.
Run after S2, on the same PostHog instance.

## Question

Does the self-hosted build include the Endpoints product, and can endpoints be
created, updated and run through the API with a personal API key?

## Why it matters

Each feature is planned as a saved PostHog endpoint, registered from files in
`contracts` by the setup command. Endpoints is in beta and may be missing or
gated in the self-hosted build.

## Do

1. On the instance from S2, check whether Endpoints appears in the interface.
2. With a personal API key that has the endpoint read and write scopes, try to
   create an endpoint through the API from a SQL query that returns daily counts
   of an event grouped by a property.
3. Run it through the API and compare the result with the same query through the
   regular query API.
4. Update the endpoint's query and confirm a new version is served.
5. Add a variable (for a date range) and confirm it can be passed when running.
6. Run the same query 100 times through each route and record response times and
   any rate limiting.

## Pass

Endpoints can be created, updated, parameterised and run entirely through the API.

## Deliver

`docs/spikes/findings/S3.md` with: pass or fail, the exact API calls that worked,
response times for both routes, any limits hit, and PostHog version.

## If it fails

The PostHog event source runs the same queries through the regular query API,
behind the same `EventSource` interface. Record this in the finding as something
to revisit before scaling, because PostHog discourages recurring use of that route.

## Out of bounds

No engine code, no feature definitions. One placeholder query is enough.
