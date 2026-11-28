# Engine demo

Run `make install`, then start the demo from the repository root with:

```sh
pnpm --filter @implicity/engine-demo dev
```

Open <http://127.0.0.1:5323>. The demo-only Python host runs the real engine on
port 5322, uses a fake event source with canned counts, and exposes the State
API, Keep and Undo. The React package uses that same HTTP interface. The host
and demo import nothing from `api/` or `web/`.
