Status: DONE

Summary:
- Added account profile/theme types in `frontend/src/lib/types.ts`.
- Added account API helpers and shared authenticated JSON mutation handling in `frontend/src/lib/api.ts`.
- Added local theme preference utility in `frontend/src/lib/theme.ts`.
- Wired auth initialization, login, and in-memory user patches to apply stored or backend theme preferences in `frontend/src/lib/auth.tsx`.
- Added institutional dark theme selectors in `frontend/src/index.css`.

Verification:
- RED: `cd frontend && npm run build` failed with temporary contract test because account/theme exports did not exist yet.
- GREEN: `cd frontend && npm run build` passed with the temporary contract test.
- FINAL: `cd frontend && npm run build` passed after removing the temporary contract test.

Concerns:
- None.
