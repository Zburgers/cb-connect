# Browser track: Playwright and Fedora system Chrome

Use this reference for visible/manual browser QA, system-Chrome validation, and
the distinction between browser control and native desktop control.

## Select the browser mode

| Need | Command/config | Evidence |
| --- | --- | --- |
| Deterministic unauthenticated E2E | `playwright.config.ts` | Playwright assertions, trace/report |
| Authenticated release smoke | `playwright.release.config.ts` | Fixture setup, desktop/mobile results, teardown |
| Visible manual UI exploration | `playwright-cli` or a headed Playwright context | Snapshot, screenshot, console/network observations |
| Attach to an existing controlled browser | `playwright-cli attach` or CDP | Attached session name and page evidence |

The default `playwright.config.ts` uses Playwright’s bundled Chromium. The
release config additionally honors `PLAYWRIGHT_EXECUTABLE_PATH`. Use the
release config when the requirement is specifically “Playwright plus system
Chrome.”

## Fedora display preflight

Visible browser control requires an active graphical session and an X11
authorization path. Check values without copying secrets into logs:

```bash
printf 'DISPLAY=%s\nWAYLAND_DISPLAY=%s\nXDG_RUNTIME_DIR=%s\n' \
  "${DISPLAY-}" "${WAYLAND_DISPLAY-}" "${XDG_RUNTIME_DIR-}"
test -n "${DISPLAY-}" || { echo 'DISPLAY is not set'; exit 1; }
test -x /opt/google/chrome/chrome || { echo 'system Chrome missing'; exit 1; }
```

When Playwright launches Chrome through the real Fedora display, retain the
session’s current `XAUTHORITY` and `XDG_RUNTIME_DIR`; do not guess a hardcoded
auth file. If the display is unavailable, use headless/CLI checks and report
visible QA as BLOCKED. `xvfb-run` is useful for invisible automation but is not
evidence that a human-visible browser was controlled.

## Visible Playwright launch

The supported executable is `/opt/google/chrome/chrome`. A one-off Node probe
can prove that the browser opens, navigates, and closes without putting a
profile or credentials in the repository:

```bash
PLAYWRIGHT_EXECUTABLE_PATH=/opt/google/chrome/chrome \
  node <<'NODE'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000');
  console.log(`browser smoke: ${await page.title()}`);
  await browser.close();
})().catch((error) => { console.error(error.message); process.exit(1); });
NODE
```

For repeatable tests, prefer a checked-in Playwright spec and the config’s
`use.launchOptions.executablePath` rather than ad-hoc selectors. Do not put
`headless: false` in CI unless the runner explicitly supplies a display.

## `playwright-cli` visible session

Confirm the installed CLI surface first:

```bash
playwright-cli --help
playwright-cli open --help
```

Use a named, dedicated persistent profile so the user’s normal Chrome profile
is never touched:

```bash
playwright-cli open http://127.0.0.1:3000 \
  --browser=chrome --headed --persistent --profile=cb-connect-qa
playwright-cli snapshot
playwright-cli click "getByRole('link', {name: 'Sign in'})"
playwright-cli screenshot
playwright-cli console
playwright-cli requests
playwright-cli close
playwright-cli close-all
```

Use the snapshot’s current element references or semantic locators; do not
reuse stale references after navigation. `state-save` and `state-load` are
authentication-bearing operations: use them only with a run-scoped restricted
path that is ignored by Git, and delete the state after the run.

## Existing-browser attachment

Attaching to an existing browser is a separate mode and requires an explicit
CDP/extension endpoint or a CLI-supported attach target:

```bash
playwright-cli list
playwright-cli attach --help
playwright-cli attach <session-name>
playwright-cli snapshot
playwright-cli detach
```

Do not infer that an attached browser is the user’s whole PC. Playwright
controls browser pages/tabs. Native desktop or OS-level control is a separate
computer-use capability and needs its own explicit permission/approval; this
skill does not silently request or enable it.

## Browser evidence and cleanup

Record the URL, browser executable, headed/headless mode, display mode, session
name, and observed result. Keep screenshots and traces private if they contain
account data. Close only the dedicated session and never kill unrelated user
browsers.
