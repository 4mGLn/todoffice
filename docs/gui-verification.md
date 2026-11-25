# Desktop GUI verification

Run the focused Playwright CLI checks when changing a Home or Docs flow. They use the built TodOffice Electron application. Use the workspace unit tests for isolated logic and `npm run test:e2e` for the full native regression suite, including platform menus and dialogs.

Install the Playwright CLI version used to verify this runner, then build TodOffice. After changes, rebuild the affected workspaces before running the check again.

```sh
npm ci
npm install -g @playwright/cli@0.1.22
npm run build:all
```

```sh
npm run verify:gui -- --list
npm run verify:gui -- --case=home
npm run verify:gui -- --case=docs --screenshots
npm run verify:gui
```

Each command can take more than one `--case` flag. With no flags, the runner checks both flows in one app instance and one named CLI session.

| Case   | What it verifies                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home` | Changing the Sheets option in Settings updates Home and leaves the Docs card visible.                                                                                                                                                                                       |
| `docs` | Opens a sample from Home, selects the traditional Mongolian writing direction, verifies the rendered `vertical-lr` layout, types through the editor and clicks Save. The runner reads the saved DOCX back to check the original and entered text and the section direction. |

On Linux without a display, run `xvfb-run -a npm run verify:gui` if Xvfb is installed. The runner uses the Electron bundled with the workspace, so there is no separate browser download.

## Evidence and extension

Open the printed directory under `output/playwright/` for `summary.json`, which reports each selected case and elapsed time. Use `--screenshots` to capture passing renderers. If a renderer step fails, the runner attempts a screenshot and adds an accessibility snapshot to the error in the summary. A failed case exits with a nonzero status.

The app runs in a disposable profile with AI disabled and synthetic test documents. The CLI attaches only to the loopback endpoint from that profile. The runner detaches its own session, closes the app and removes the profile and fixtures.

Add a self-contained flow in [gui-cases.ts](../e2e/gui-cases.ts) and pass fixture data through its input. Batch related actions with `run-code` and wait for the expected DOM state. Native file pickers, OS menus and IME behavior need native verification. The Docs case verifies Chromium text entry and the saved file; it does not exercise an OS input method.
