var lock = require('./pointer-lock-chrome-tolerant'),
  fullscreen = require('fullscreen'),
  through = require('through'),
  min = Math.min,
  max = Math.max,
  signals = require('signals');

module.exports = trap;

function trap(element, mode) {
  var write;
  switch (mode) {
    case 'deltas':
      write = writeDeltas;
      break;
    case 'clamped':
      write = writeClamped;
      break;
    case 'unclamped':
      write = writeUnclamped;
      break;
    default:
      write = writeDeltas;
  }

  var pointer = lock(element),
    output = through(write),
    pos = (output.pos = {}),
    onAttainSignal = new signals.Signal(),
    onReleaseSignal = new signals.Signal();

  output.trapped = false;
  output.onAttainSignal = onAttainSignal;
  output.onReleaseSignal = onReleaseSignal;

  var lastX,
    lastY,
    move = { dx: 0, dy: 0 };
  element.addEventListener('mousemove', mousemove);

  function mousemove(e) {
    if (output.trapped) return;
    if (lastX === undefined) lastX = e.pageX;
    if (lastY === undefined) lastY = e.pageY;
    move.dx = e.pageX - lastX;
    move.dy = e.pageY - lastY;
    lastX = e.pageX;
    lastY = e.pageY;
    output.write(move);
  }

  element.addEventListener('click', click);

  function click(e) {
    if (output.trapped) return;
    pos.x = e.pageX;
    pos.y = e.pageY;
    pointer.request();
  }

  pointer.on('attain', function(movements) {
    output.trapped = true;
    movements.pipe(output, { end: false });
    onAttainSignal.dispatch();
  });

  pointer.on('release', function() {
    output.trapped = false;
    onReleaseSignal.dispatch();
  });

  pointer.on('error', function(e) {
    output.trapped = false;
    onReleaseSignal.dispatch();
  });

  // workaround for browsers which only
  // allow pointer lock in fullscreen mode.
  pointer.on('fullscreen', function() {
    var fs = fullscreen(element);
    fs
      .once('attain', function() {
        pointer.request();
      })
      .request();
  });

  function writeClamped(move) {
    pos.x += move.dx;
    pos.y += move.dy;
    pos.x = min(max(pos.x, 0), element.clientWidth);
    pos.y = min(max(pos.y, 0), element.clientHeight);
    this.queue(pos);
  }

  function writeUnclamped(move) {
    pos.x += move.dx;
    pos.y += move.dy;
    this.queue(pos);
  }

  function writeDeltas(move) {
    pos.x = move.dx;
    pos.y = move.dy;
    this.queue(pos);
  }

  function destroy() {
    pointer.destroy();
    element.removeEventListener('mousemove', mousemove);
    element.removeEventListener('click', click);
  }

  function release() {
    pointer.release();
  }

  output.destroy = destroy;
  output.release = release;

  return output;
}
