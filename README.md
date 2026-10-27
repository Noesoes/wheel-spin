# wheel-spin

A spin-the-wheel web app with all 32 NFL teams.

- Click **SPIN** to pick a random team
- Filter by conference (AFC/NFC) or toggle individual teams
- Optionally remove each winner from the wheel after it's picked

## Hosting on GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the site on every push to `main`.
One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
The site will be at `https://<your-username>.github.io/wheel-spin/`.

To run locally, just open `index.html` in a browser.
