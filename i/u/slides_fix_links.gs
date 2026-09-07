/**
 * Fix Gorm links in this Google Slides deck (visible text):
 *   https://gormb.github.io/_?<base>     ->  https://aigap.no/<base>
 *   https://gormb.github.io/_?<base>qr   ->  https://aigap.no/<base>
 *   https://gormb.github.io/_?<base>qra  ->  https://aigap.no/<base>
 *
 * No Advanced services needed - just open the deck ->
 * Extensions -> Apps Script, paste this, press Run.
 *
 * NOTE: this changes the text shown in the deck. If your items are QR IMAGES,
 * replace text does NOT change what the images encode - swap in the new QR
 * images for those. (Retargeting clickable hyperlink URLs needs the Slides
 * REST/Advanced service, which this intentionally avoids.)
 */
function fixGormbLinks() {
  const deck = SlidesApp.getActivePresentation();
  let n = 0;

  function fix(text) {
    const s = text.asString();
    if (s.indexOf('gormb.github.io/_?') < 0) return;
    const fixed = s.replace(/https:\/\/gormb\.github\.io\/_\?([A-Za-z0-9]+)/g, function (m, id) {
      const base = id.endsWith('qra') ? id.slice(0, -3)
                 : id.endsWith('qr')  ? id.slice(0, -2)
                 : id;
      return 'https://aigap.no/' + base;
    });
    if (fixed !== s) { text.replaceAllText(s, fixed); n++; }
  }

  for (const slide of deck.getSlides()) {
    for (const el of slide.getPageElements()) {
      try {
        const type = el.getPageElementType();
        if (type === SlidesApp.PageElementType.SHAPE) {
          fix(el.asShape().getText());
        } else if (type === SlidesApp.PageElementType.TABLE) {
          const t = el.asTable();
          for (let r = 0; r < t.getNumRows(); r++)
            for (let c = 0; c < t.getNumColumns(); c++)
              fix(t.getCell(r, c).getText());
        }
      } catch (e) { /* ignore individual element errors */ }
    }
  }
  Logger.log('Done. Text blocks updated: ' + n);
}

/** Alias so pressing the default Run (myFunction) works. */
function myFunction() {
  fixGormbLinks();
}
