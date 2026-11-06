<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Frontend only: no backend, database or hosted auth in this repo; a separate Flask backend enforces all authorization.
- All backend calls go through `src/services/api/` (one function per Flask endpoint); components never call fetch directly.
- Mock data lives only in `src/mocks/` and is used by the service layer when `VITE_USE_MOCKS` is not "false", so it can be removed without touching UI.
- The preview role switcher (`src/lib/preview-role.tsx`) only changes layout; never treat it as authorization.
