# PostHog S2 and S3 spike prototype

**PROTOTYPE — throwaway measurements, not production code.** Event names and properties are placeholders. No message text, filenames, or key presses are captured.

The scripts target the local project and personal API key in the ignored `.env`. The isolated Compose project `s2-s3-posthog` remains running at `http://127.0.0.1:8010` for inspection. Its app image is PostHog `master`, revision `be0a6f2a4cb4f9614a7954e01032ca3223bfdbaf`; the project uses the upstream-derived Hobby Compose file already present in the local Implicity deployment. Docker Desktop was set to 19.5 GiB (Mac: 32 GiB).

Run these in order, with the stack running:

```sh
python3 spikes/s2-s3-posthog/s2.py
python3 spikes/s2-s3-posthog/s3.py
```

Each run writes its raw measurements beside the scripts: `s2-timings.csv`, `s2-session-summary.json`, `s3-timings.csv`, and `ram.csv`. `s3-setup.json` records the API setup calls and outcome. `bootstrap.py` provisions a local project and scoped personal key; generated credentials belong only in `.env`.
