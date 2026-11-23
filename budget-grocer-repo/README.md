# Budget Grocer

**Live site:** https://YOUR-USERNAME.github.io/budget-grocer/  *(replace with your own GitHub Pages link once it is published)*

Write a shopping list or plan meals, give a place in Spain, and Budget Grocer shows which nearby supermarket has the cheapest basket. Built for the Webs and Apps Design course at IE University.

Plain HTML, CSS and JavaScript. There is no build step, so GitHub Pages serves it as it is.

## How to use it
1. **My list**: type what you need or tap Quick add. Each item you write shows its photo straight away.
2. **Plan meals** (optional): pick a meal, choose servings, and the site lists exactly what to buy. Those ingredients join your basket.
3. **Near me**: type a town or postcode, or use your location.
4. **Checkout**: compares the supermarkets and shows the cheapest basket and your saving.

## Files
- `index.html` structure and copy
- `styles.css` look and layout (earthy pastel palette, Rampart One + Sour Gummy from Google Fonts)
- `script.js` catalogue, meals, basket, map look-ups and results
- `images/` food cutouts (`<item>.png`), meal photos (`meals/<meal>.jpg`) and the aisle background (`aisle.jpg`)

## How it works
- Prices are **estimates**: a base price per item × a per-chain factor × a small fixed variation. They are not live store data.
- Shops come from OpenStreetMap (Nominatim and Open-Meteo for places, Overpass for supermarkets). If the map services cannot be reached, typical prices for the six main chains are shown with a note.
- Lists are matched to the catalogue by keyword with a small typo tolerance. Meal ingredients and list items are merged, so two meals that need onions share one bag.
- The basket is saved in the browser (localStorage), so it survives a refresh.

## Accessibility
Keyboard-friendly controls with visible focus, a native `<dialog>` for meals, live regions for results, labelled form fields, and reduced motion respected.

## Limits
Estimated prices, shop data can be incomplete, Spain only.

## Credits
- Shop data © OpenStreetMap contributors.
- Fonts: Rampart One and Sour Gummy (Google Fonts, open licence).
- Food and meal images supplied by the author. Aisle background: the author's chosen reference image.

## AI acknowledgement
*(Write this in your own words, following the course guidelines. Say which parts of the work AI helped with, for example planning the layout, writing and debugging code, and drafting copy, and which parts you decided and made yourself.)*


