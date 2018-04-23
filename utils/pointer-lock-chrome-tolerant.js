module.exports = pointer;

pointer.available = available;

var EventEmitter = require('events').EventEmitter,
  Stream = require('stream').Stream;

function available() {
  return !!shim(document.body);
}

function pointer(el) {
  var addEventListener = el.addEventListener || el.attachEvent,
    removeEventListener = el.removeEventListener || el.detachEvent,
    doc = el.ownerDocument,
    body = doc.body,
    requestPointerLock = shim(el),
    out = { dx: 0, dy: 0, dt: 0 },
    eventEmitter = new EventEmitter(),
    stream = null,
    skipPixelTolerance = 4,
    lastPageX = 0,
    lastPageY = 0,
    biggestMovementX = 0,
    biggestMovementY = 0,
    virtualBuggyX = 0,
    virtualBuggyY = 0,
    buggyX = 0,
    buggyY = 0,
    virtualInfiniteX = 0,
    virtualInfiniteY = 0,
    needsFullscreen = false,
    mouseDownMS;

  addEventListener.call(el, 'mousedown', onmousedown, false);
  addEventListener.call(el, 'mouseup', onmouseup, false);
  addEventListener.call(body, 'mousemove', onmove, false);

  var vendors = ['', 'webkit', 'moz', 'ms', 'o'];

  for (var i = 0, len = vendors.length; i < len; ++i) {
    addEventListener.call(
      doc,
      vendors[i] + 'pointerlockchange',
      onpointerlockchange
    );
    addEventListener.call(
      doc,
      vendors[i] + 'pointerlockerror',
      onpointerlockerror
    );
  }

  eventEmitter.release = release;
  eventEmitter.target = pointerlockelement;
  eventEmitter.request = onmousedown;
  eventEmitter.destroy = destroy;

  if (!shim) {
    setTimeout(function() {
      eventEmitter.emit('error', new Error('pointer lock is not supported'));
    }, 0);
  }
  return eventEmitter;

  function onmousedown(ev) {
    if (pointerlockelement()) {
      return;
    }
    mouseDownMS = +new Date();
    requestPointerLock.call(el);
  }

  function onmouseup(ev) {
    if (!needsFullscreen) {
      return;
    }

    // eventEmitter.emit('needs-fullscreen');
    needsFullscreen = false;
  }

  function onpointerlockchange(ev) {
    biggestMovementX = biggestMovementY = 0;
    if (!pointerlockelement()) {
      if (stream) release();
      return;
    }

    stream = new Stream();
    stream.readable = true;
    stream.initial = { x: lastPageX, y: lastPageY, t: Date.now() };

    eventEmitter.emit('attain', stream);
  }

  function onpointerlockerror(ev) {
    var dt = +new Date() - mouseDownMS;
    if (dt < 100) {
      // we errored immediately, we need to do fullscreen first.
      needsFullscreen = true;
      return;
    }

    eventEmitter.emit('error');
    if (stream) {
      stream.emit('error', ev);
    }
    stream = null;
  }

  function release() {
    eventEmitter.emit('release');

    if (stream) {
      stream.emit('end');
      stream.readable = false;
      stream.emit('close');
      stream = null;
    }

    var pel = pointerlockelement();
    if (!pel) {
      return;
    }

    (
      doc.exitPointerLock ||
      doc.mozExitPointerLock ||
      doc.webkitExitPointerLock ||
      doc.msExitPointerLock ||
      doc.oExitPointerLock
    ).call(doc);
  }

  function onmove(ev) {
    lastPageX = ev.pageX;
    lastPageY = ev.pageY;
    if (!stream) return;

    // we're reusing a single object
    // because I'd like to avoid piling up
    // a ton of objects for the garbage
    // collector.
    var dx =
      ev.movementX ||
      ev.webkitMovementX ||
      ev.mozMovementX ||
      ev.msMovementX ||
      ev.oMovementX ||
      0;

    var dy =
      ev.movementY ||
      ev.webkitMovementY ||
      ev.mozMovementY ||
      ev.msMovementY ||
      ev.oMovementY ||
      0;

    out.dx = dx;
    out.dy = dy;
    out.dt = Date.now() - stream.initial.t;

    virtualBuggyX += dx;
    virtualBuggyY += dy;
    var mightHaveFoundBuggyOrigin = false;
    if (
      (dx > 0 && dx > biggestMovementX) ||
      (dx < 0 && dx < -biggestMovementX)
    ) {
      biggestMovementX = Math.abs(dx);
      mightHaveFoundBuggyOrigin = true;
    }

    if (
      (dy > 0 && dy > biggestMovementY) ||
      (dy < 0 && dy < -biggestMovementY)
    ) {
      biggestMovementY = Math.abs(dy);
      mightHaveFoundBuggyOrigin = true;
    }

    if (mightHaveFoundBuggyOrigin) {
      buggyX = virtualBuggyX;
      buggyY = virtualBuggyY;
    }

    if (
      Math.abs(virtualBuggyX - buggyX) < skipPixelTolerance &&
      Math.abs(virtualBuggyY - buggyY) < skipPixelTolerance
    ) {
      out.dx = 0;
      out.dy = 0;
    }
    eventEmitter.emit('data', out);
    stream.emit('data', out);
  }

  function pointerlockelement() {
    return (
      0 ||
      doc.pointerLockElement ||
      doc.mozPointerLockElement ||
      doc.webkitPointerLockElement ||
      doc.msPointerLockElement ||
      doc.oPointerLockElement ||
      null
    );
  }

  function setBuggyOrigin(x, y) {
    // console.log('buggy', x, y);
  }

  function destroy() {
    removeEventListener.call(el, 'mouseup', onmouseup, false);
    removeEventListener.call(el, 'mousedown', onmousedown, false);
    removeEventListener.call(el, 'mousemove', onmove, false);
    removeEventListener.call(body, 'mousemove', onmove, false);
    for (var i = 0, len = vendors.length; i < len; ++i) {
      removeEventListener.call(
        doc,
        vendors[i] + 'pointerlockchange',
        onpointerlockchange
      );
      removeEventListener.call(
        doc,
        vendors[i] + 'pointerlockerror',
        onpointerlockerror
      );
    }
  }
}

function shim(el) {
  return (
    el.requestPointerLock ||
    el.webkitRequestPointerLock ||
    el.mozRequestPointerLock ||
    el.msRequestPointerLock ||
    el.oRequestPointerLock ||
    null
  );
}
