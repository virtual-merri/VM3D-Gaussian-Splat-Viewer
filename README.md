# VM3D Gaussian Splat Viewer

An experimental, standalone browser viewer for 3D Gaussian Splats using the PlayCanvas Engine. It is intentionally separate from the VM3D clone while rendering and performance are tested.

## Current prototype
- Load local `.ply` and `.sog` files (the file stays in the browser).
- Load a remote splat by direct URL (the host must permit browser CORS requests).
- Load the public PlayCanvas sample.
- Orbit, pan, zoom and reset the camera.

## Run locally
Serve this folder using a local web server (for example VS Code Live Server). Do not open `index.html` directly as a `file://` URL.

## Publish with GitHub Pages
1. Open repository **Settings → Pages**.
2. Choose **Deploy from a branch**.
3. Select `main` and `/(root)`, then save.
4. Wait for the Pages deployment to finish.

## Controls
| Input | Action |
|---|---|
| Left mouse drag | Orbit |
| Right mouse drag | Pan |
| Shift + left drag | Pan |
| Mouse wheel | Zoom |
| Double click | Reset view |

## Current limitations
This is a rendering test, not yet a geospatial viewer. It does not georeference scans, interpret coordinate systems, combine multiple splats, or automatically frame arbitrary scan bounds. Those are candidates for later development after testing real PortalCam / ArcGIS Reality exports.

Large PLY files can require substantial browser memory. SOG is generally preferable for web delivery where available.

## Technology
- [PlayCanvas Engine](https://github.com/playcanvas/engine)
- [PlayCanvas Gaussian Splat documentation](https://developer.playcanvas.com/user-manual/gaussian-splatting/)
