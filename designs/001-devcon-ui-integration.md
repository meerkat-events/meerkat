## Devcon UI Integration

> **Historical design record** (February 2026). The API sketch it once held
> is now the package itself: see
> [`packages/react/README.md`](../packages/react/README.md) for the current
> hooks and types.

In the 2026 Devcon, we will integrate Meerkat UI directly into the Devcon
website. We expect real-time connection to work out of the box.

We want to display a subset of `api/app/routes/QnA.tsx`. We don't need to
include any session details like the name.

The `@meerkat-events/react` package provides the data fetching and the
real-time connection for that. In its first iteration it only fetches the
questions to display in the UI; asking questions and voting may come later.
The provider takes the API URL, and the API must allow the consumer's origin
via CORS headers, including for the SSE endpoints.
