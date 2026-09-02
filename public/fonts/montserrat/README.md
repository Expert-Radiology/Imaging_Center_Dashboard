# Montserrat — self-hosted

Copy the design system's Montserrat files into this directory:

    Expert Radiology Design System v2 / fonts/montserrat/  →  public/fonts/montserrat/

`src/styles/global.css` expects a variable font at:

    /fonts/montserrat/montserrat-variable.woff2   (weights 400–800, latin + latin-ext)

If the design system ships static weights instead of a variable file, replace the
single `@font-face` in `global.css` with one block per weight (400, 500, 600, 700, 800)
pointing at those filenames.

Do **not** swap this for the Google Fonts CDN — the design system requires self-hosting,
and the Static Web App's CSP (`staticwebapp.config.json`) blocks third-party font origins.

Until the files are present the app falls back to a locally installed Montserrat, then
to the system sans stack. Layout metrics will be close but not exact.
