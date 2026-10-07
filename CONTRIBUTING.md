# Contribution Guidelines

We welcome all developers to contribute to Daily Workspace! Your efforts are truly appreciated. To ensure smooth collaboration, please keep the following points in mind before submitting your pull requests:

## 1. Set Up Your Environment
- `npm install` to install dependencies.
- `npm run dev` to start Vite and load the generated `dist` folder as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked). It hot-reloads as you edit.
- `npm run build` (type-checks and builds), `npm run lint`, and `npm test` should all pass before you open a pull request.

## 2. Add Only Relevant Code
- Avoid unnecessary modifications to existing code, including formatting changes.
- Refrain from using options like "Format Document" in editors like VS Code, as these changes make it difficult to review the actual modifications.

## 3. Provide Visual Context
- Always attach a screenshot or screen recording of your changes in action.
- Include a detailed description of the changes and their purpose in the pull request.

## 4. Follow Code Style Guidelines
- Stick to the existing coding style and structure of the project (React function components, hooks in `src/lib`, Tailwind utility classes).
- Use consistent indentation and naming conventions.

## 5. Avoid Adding Unnecessary Dependencies
- Before adding any library or dependency, explain its purpose and confirm that it's essential for the functionality you're implementing.

## 6. Test Thoroughly
- Ensure that your changes are fully functional and do not introduce any bugs or performance issues.
- Test your code on various screen sizes, including narrow/mobile viewports, since the dashboard has to remain usable at small widths.
- If your change touches a `chrome.*` API, check the behavior both when the relevant permission is granted and when it's denied.

## 7. Test Across Browsers
- This is a Manifest V3 extension that targets both Chromium-based browsers (Chrome, Edge, Brave, Opera) and Firefox. `npm run build` produces the Chromium build in `dist/`; `npm run build:firefox` additionally produces a Firefox-compatible build in `dist-firefox/` (see the README's Installation section for how to load each). If your change touches the background script, the manifest, or anything browser-detection related (see `ShortcutIcon.tsx`'s Firefox favicon fallback), verify it in both.

## 8. Keep Pull Requests Focused
- Focus on one feature or fix per pull request. Avoid bundling unrelated changes together.

## 9. Document Changes
- If your changes introduce new functionality, update the README's feature list and any relevant documentation.

By following these guidelines, we can maintain a clean and efficient codebase while making the review process faster and easier for everyone. Thank you for your contributions and for helping improve this project!

## 10. Releasing a Version

Releases follow [Semantic Versioning](https://semver.org/). Below `1.0.0`, a minor bump may still
change how data is stored, so every release says what happens to existing data on upgrade.

1. **Bump the version in both files.** `public/manifest.json` is the one browsers and stores read —
   it must increase for an update to be recognised. Keep `package.json` on the same number; the
   backup export stamps files with the manifest version, so a mismatch makes exports misreport
   which build produced them.
2. **Add a `CHANGELOG.md` entry** under a new version heading, with `Added` / `Changed` / `Fixed`
   sections and an **Upgrading** section covering: data migrations that run on first open, whether
   older backup files still import, and any new permissions (say explicitly whether the browser will
   prompt, since a permission that triggers a warning disables the extension until the user
   re-approves it).
3. **Verify before tagging.** `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`, and
   `npm run build:firefox` must all pass.
4. **Package with `npm run package`.** Never zip `dist/` by hand and never upload it directly. The
   script rebuilds both targets, verifies them, and writes `release/*.zip`. Verification exists
   because a development build is indistinguishable from a real one by eye — same folder, same
   manifest, same icons — and the only symptom is that every user's new tab becomes
   "CRXJS DEV MODE". That shipped as 0.2.0.
5. **Install the zip before publishing it.** Unzip it somewhere fresh, load it unpacked, and open a
   new tab. This is the only step that catches a packaging fault end to end.
6. **Tag and publish.** Tag as `v<version>` and push the tag, then create a GitHub Release whose
   notes are that changelog entry.
7. **Update the store listings** if the extension is published: the Chrome Web Store and
   addons.mozilla.org each have their own "What's new" field, which is not generated from this repo.
