/**
 * Resize every QR image in this Google Slides deck to 3 cm x 3 cm.
 * Run AFTER pasting the QR images (at whatever size they came in).
 *
 * How to use:
 *  1. Slides -> Extensions -> Apps Script.
 *  2. Paste this file.
 *  3. Press Run (function resizeAllQrs). Authorize if asked.
 */
function resizeAllQrs() {
  var CM = 28.3465;          // points per cm
  var side = 3 * CM;         // 3 cm in points
  var deck = SlidesApp.getActivePresentation();
  var n = 0;
  deck.getSlides().forEach(function (slide) {
    slide.getImages().forEach(function (img) {
      // keep the image centred on its current position
      var x = img.getLeft(), y = img.getTop();
      img.setWidth(side);
      img.setHeight(side);
      img.setLeft(x);
      img.setTop(y);
      n++;
    });
  });
  Logger.log('Resized ' + n + ' images to 3 cm');
}

/** Alias so the default Run button works. */
function myFunction() {
  resizeAllQrs();
}
