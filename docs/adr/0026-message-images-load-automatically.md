---
status: accepted
---

# Message images load automatically

An image in a message's markdown loads automatically, as a plain `<img>`, over https only, with no referrer and no CORS mode. An image that cannot load, or is not https, shows a placeholder with its alt text and host. MessageBody renders markdown only: raw HTML is shown as text, so markup such as `<picture>` cannot get around the https rule. No choice is remembered per host in Stage 1, and loading an image records no event.

## Considered options

- **Load only on a click**, with a placeholder first. Safest, since nothing is requested until the person asks, but every image in every answer would need a click.
- **CORS-mode images** (`crossOrigin="anonymous"`), which never send cookies. Most image hosts send no CORS header, so ordinary images would fail to load.
- **Fetch images through our backend**, cookie-free and reliable, but a new backend job and a request maker on the person's machine.
- **A page-wide `credentialless` embedder policy**, cookie-free, but not supported by every target browser.

## Consequences

- The risk is accepted knowingly. The model writes the image URL, so loading it tells that host the person's IP address and that the answer was viewed, and the URL itself can carry data from the conversation, for example when a fetched page instructs the model to embed such an image. A browser may send that host's cookies where its third-party cookie rules allow.
- Plain http and `data:` images never load.
- A later stage can add a per-host or global setting through the normal setting and proposal path, or move to a backend fetch, without changing message specs.
