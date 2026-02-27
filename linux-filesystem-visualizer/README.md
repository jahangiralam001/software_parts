# Linux Filesystem Visualizer

Interactive static site to learn Linux top-level directories with:

- Bird's-eye filesystem directory view
- 7-question learning format per directory
- Practical command examples
- Quick comparison tables
- Quiz mode + revision mode + saved progress

## Run locally (required)

If you open `index.html` directly via `file:///...`, some browsers block module scripts, and the tree/search area can appear empty.

Use a local server instead:

1. Open terminal in this folder (`software_parts/linux-filesystem-visualizer`)
2. Run:

   ```bash
   python -m http.server 5500
   ```

3. Open:

   `http://localhost:5500`

## If search/tree is still empty

- Hard refresh: `Ctrl + F5`
- Check browser console for blocked scripts
- Confirm URL starts with `http://localhost:5500` (not `file:///`)
