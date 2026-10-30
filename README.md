# AI Capability Assessment

A browser-only assessment of how ready a marketing function is for AI. One assessor scores 35 capabilities across seven categories on a five-level scale, sees results on screen and downloads them as XLSX. Nothing is sent to a server or stored. Workmatik brand.

Live address (after GitHub Pages is switched on): https://scottstockwellworkmatik.github.io/marketing-ai-capability-assessment/

## Files and folders

```
index.html            The page
og-image-sharp.png     LinkedIn and social preview image (1200 x 630)
favicon files         favicon.ico, favicon.svg, favicon-96x96.png, apple-touch-icon.png, web-app-manifest-*.png, site.webmanifest
.nojekyll             Tells GitHub Pages to serve the files as they are
assets/               logo-black.svg (used in the header), logo-white.svg (spare)
css/styles.css        Styling
js/app.js             The app
lib/xlsx.full.min.js  SheetJS, reads the XLSX files in the browser
lib/exceljs.min.js    ExcelJS, writes the XLSX downloads with the radar chart image
data/framework.json   Categories, capabilities, questions, evidence, level descriptors, thresholds
```

## How scores work

- Capability score: the level chosen, 1 to 5. Out-of-scope capabilities are left out.
- Category score: average of the scored capabilities in the category.
- Overall score: average of the seven category scores (equal weights). The level is the nearest whole level.
- Critical capabilities S1, S3, S4 and W2 are flagged at or below the critical-gap threshold (default 2).
- Uneven profile is flagged when the strongest and weakest category differ by the threshold or more (default 1.5).
- Both thresholds, the critical flags, the level descriptors and the journey-map phases used in "Where to start" are the author's draft judgement and have no published source.

## Compare over time

The Compare tab reads earlier XLSX downloads (up to six) and, optionally, the assessment on the page. It orders them by the date in each file's Summary sheet and shows the overall trend, each category side by side with the change from first to last, an overlaid radar chart, the four critical capabilities over time, and the capabilities that improved or declined. "Download comparison (XLSX)" saves the tables and the overlaid radar chart. Files with no date are shown in the order loaded.

## Changing the content

Edit `data/framework.json`. The capabilities are listed in order inside `capabilities`; `levels` holds the five descriptors, `critical` marks a starred capability and `phase` (0 to 4) is the journey-map phase used to order "Where to start".

## Saved files

The XLSX download has Summary, Scoring and Results sheets. The Assessment tab can load a downloaded file back (it reads the Scoring and Summary sheets), so keep the column headings as they are.
