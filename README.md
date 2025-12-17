# SantaCam (mock)

A single-page, mobile-friendly “Santa Cam” console:
- Live camera preview (when allowed)
- Still photo capture fallback (works on more phones)
- Scrolling official-looking telemetry log
- “Activate Remote Hardware” button that shows a connection/arming overlay, then returns to the camera + logs

## Run it

### Option A: simple local server (recommended)
From this folder:

- Python:
  - `python -m http.server 8000`

Then open:
- On the same device: `http://localhost:8000/`
- From your phone on the same Wi‑Fi: `http://<your-computer-ip>:8000/`

### Expose to your phone over the internet with ngrok (optional)

If you want to access the page from a phone away from your home network or to avoid LAN IP issues, `ngrok` can securely tunnel to your local server. Quick steps:

- Install ngrok from https://ngrok.com and sign in to get an auth token.
- Start your local server first, then run (example for port 8000):

  ```bash
  ngrok http 8000
  ```

- ngrok will show a public HTTPS URL (for example `https://abcd-12-34-56.ngrok.io`). Open that on your phone.

- Note: Mobile browsers require HTTPS to grant live camera access to `getUserMedia`. The ngrok HTTPS URL satisfies that requirement so `Start Live Camera` should work.

### Option B: open the file directly
You can try opening `index.html` directly in the mobile browser, but some browsers restrict features when not served from a web origin.

## Camera notes (important)

- **Live camera preview** (`getUserMedia`) typically requires **HTTPS** on phones (secure context). If you serve this from plain `http://<LAN IP>`, most mobile browsers will block live camera access.
- **Still photo capture** via the "Take Still Photo" button uses the device camera picker (`<input capture>`), which usually works even when live preview is blocked.

If you want true live camera on the phone over Wi‑Fi, serve it over HTTPS (self-signed cert is fine for a home setup, but the browser will show a warning).

## Files

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)

## Putting this on GitHub

1. Initialize a git repo and commit the files locally (already done if you ran the helper script):

  ```bash
  git init
  git add .
  git commit -m "Initial SantaCam mock UI"
  ```

2. Create an empty repository on GitHub (via github.com) and copy the remote URL (SSH or HTTPS).

3. Add the remote and push — replace `<REMOTE-URL>` with your repo URL:

  ```bash
  git remote add origin <REMOTE-URL>
  git branch -M main
  git push -u origin main
  ```


