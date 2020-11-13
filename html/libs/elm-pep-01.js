// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Variable to hold current primary touch event identifier.
// iOS needs this since it does not attribute
// identifier 0 to primary touch event.
let primaryTouchId = null;

// Variable to hold mouse pointer captures.
let mouseCaptureTarget = null;

if (!("PointerEvent" in window)) {
  // Define {set,release}PointerCapture
  definePointerCapture();

  // Create Pointer polyfill from mouse events only on non-touch device
  if (!("TouchEvent" in window)) {
    addMouseToPointerListener(document, "mousedown", "pointerdown");
    addMouseToPointerListener(document, "mousemove", "pointermove");
    addMouseToPointerListener(document, "mouseup", "pointerup");
  }

  // Define Pointer polyfill from touch events
  addTouchToPointerListener(document, "touchstart", "pointerdown");
  addTouchToPointerListener(document, "touchmove", "pointermove");
  addTouchToPointerListener(document, "touchend", "pointerup");
}

// Function defining {set,release}PointerCapture from {set,releas}Capture
function definePointerCapture() {
  Element.prototype.setPointerCapture = Element.prototype.setCapture;
  Element.prototype.releasePointerCapture = Element.prototype.releaseCapture;
}

// Function converting a Mouse event to a Pointer event.
function addMouseToPointerListener(target, mouseType, pointerType) {
  target.addEventListener(mouseType, mouseEvent => {
    let pointerEvent = new MouseEvent(pointerType, mouseEvent);
    pointerEvent.pointerId = 1;
    pointerEvent.isPrimary = true;
    pointerEvent.pointerType = "mouse";
    pointerEvent.width = 1;
    pointerEvent.height = 1;
    pointerEvent.tiltX = 0;
    pointerEvent.tiltY = 0;

    // pressure is 0.5 if a button is holded
    "buttons" in mouseEvent && mouseEvent.buttons !== 0
      ? (pointerEvent.pressure = 0.5)
      : (pointerEvent.pressure = 0);

    // if already capturing mouse event, transfer target
    // and don't forget implicit release on mouseup.
    let target = mouseEvent.target;
    if (mouseCaptureTarget !== null) {
      target = mouseCaptureTarget;
      if (mouseType === "mouseup") {
        mouseCaptureTarget = null;
      }
    }

    target.dispatchEvent(pointerEvent);
    if (pointerEvent.defaultPrevented) {
      mouseEvent.preventDefault();
    }
  });
}

// Function converting a Touch event to a Pointer event.
function addTouchToPointerListener(target, touchType, pointerType) {
  target.addEventListener(touchType, touchEvent => {
    const changedTouches = touchEvent.changedTouches;
    const nbTouches = changedTouches.length;
    for (let t = 0; t < nbTouches; t++) {
      let pointerEvent = new CustomEvent(pointerType, {
        bubbles: true,
        cancelable: true
      });
      pointerEvent.ctrlKey = touchEvent.ctrlKey;
      pointerEvent.shiftKey = touchEvent.shiftKey;
      pointerEvent.altKey = touchEvent.altKey;
      pointerEvent.metaKey = touchEvent.metaKey;

      const touch = changedTouches.item(t);
      pointerEvent.clientX = touch.clientX;
      pointerEvent.clientY = touch.clientY;
      pointerEvent.screenX = touch.screenX;
      pointerEvent.screenY = touch.screenY;
      pointerEvent.pageX = touch.pageX;
      pointerEvent.pageY = touch.pageY;
      const rect = touch.target.getBoundingClientRect();
      pointerEvent.offsetX = touch.clientX - rect.left;
      pointerEvent.offsetY = touch.clientY - rect.top;
      pointerEvent.pointerId = 1 + touch.identifier;

      // Default values for standard MouseEvent fields.
      pointerEvent.button = 0;
      pointerEvent.buttons = 1;
      pointerEvent.movementX = 0;
      pointerEvent.movementY = 0;
      pointerEvent.region = null;
      pointerEvent.relatedTarget = null;
      pointerEvent.x = pointerEvent.clientX;
      pointerEvent.y = pointerEvent.clientY;

      // Pointer event details
      pointerEvent.pointerType = "touch";
      pointerEvent.width = 1;
      pointerEvent.height = 1;
      pointerEvent.tiltX = 0;
      pointerEvent.tiltY = 0;
      pointerEvent.pressure = 1;

      // First touch is the primary pointer event.
      if (touchType === "touchstart" && primaryTouchId === null) {
        primaryTouchId = touch.identifier;
      }
      pointerEvent.isPrimary = touch.identifier === primaryTouchId;

      // If first touch ends, reset primary touch id.
      if (touchType === "touchend" && pointerEvent.isPrimary) {
        primaryTouchId = null;
      }

      touchEvent.target.dispatchEvent(pointerEvent);
      if (pointerEvent.defaultPrevented) {
        touchEvent.preventDefault();
      }
    }
  });
}
