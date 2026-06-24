# Seal Design Mobile App — starter conversion

This is the first mobile web app scaffold built from only these workbook tabs:

- `Calculation`
- `Lookups `

Everything else in the workbook was ignored.

## What is included

- Mobile-first UI
- PWA manifest so it can be saved to a phone home screen
- Lookup tables converted to JSON
- Formula extraction retained in `data/formula-map.json`
- First-pass JavaScript calculation engine in `app.js`
- Print/PDF output via the browser print function

## What is NOT finished yet

This is not production-ready. Do not use it for real design decisions yet.

The reason is simple: the Excel workbook contains complex formulas, external-style references, and treatment-specific exceptions. The app has converted the main calculation path only:

- compound traffic
- vehicle factor `Vf`
- temperature correction
- heavy vehicle / gradient correction
- binder factor lookup
- aggregate-retention lookup
- existing coat correction
- first-pass aggregate spread rate

## Proper next step

Create validation cases from the Excel workbook:

1. Enter a known design into Excel.
2. Record the key inputs.
3. Record Excel outputs:
   - binder L/m²
   - binder litres
   - aggregate spread rate
   - aggregate quantity
   - notes/warnings
4. Enter the same values into the app.
5. Fix the app logic until results match.

Anything else is guessing.

## Run locally

Because the app fetches local JSON files, run it through a local server:

```powershell
cd seal-design-mobile-app
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files in this folder.
3. Go to Settings → Pages.
4. Set source to `main` branch, root folder.
5. Open the GitHub Pages URL on your phone.
6. Add it to the home screen.
