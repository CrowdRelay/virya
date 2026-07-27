# VIRYA — complete Git-ready project recovery

This archive is a complete project snapshot, not a partial patch.

## Safe replacement

1. Back up any uncommitted work and local `.env*` files.
2. Delete the damaged working tree contents **except `.git/`**.
3. Copy all files from this archive into the repository root.
4. Restore your local environment variables or configure them in Netlify.
5. Run:

```bash
rm -rf node_modules .astro .netlify dist
npm ci
npm test
npm run build
```

6. Verify that `src/components/Layout.astro` and the remaining components exist.
7. Commit the recovered project.

Do not copy old local `.env` files into Git. Exact Area coordinates belong only in Netlify's `AREA_LIVE_DROPS_JSON` variable.
