function controlShip(deltaTime) {
  if (keysPressed['w']) {
    spaceship.rotateX(rotationSpeed);
  }
  if (keysPressed['s']) {
    spaceship.rotateX(-rotationSpeed);
  }
  if (keysPressed['a']) {
    spaceship.rotateY(rotationSpeed);
  }
  if (keysPressed['d']) {
    spaceship.rotateY(-rotationSpeed);
  }
  if (keysPressed['q']) {
    spaceship.rotateZ(-rotationSpeed);
  }
  if (keysPressed['e']) {
    spaceship.rotateZ(rotationSpeed);
  }

  if (warpInProgress) {
    speed = Math.min(maxSpeed, speed + warpAcceleration * deltaTime);
    if (speed >= maxSpeed) {
      speed = maxSpeed;
      warpInProgress = false;
      showWarpMessage('Warp Speed');
    }
  } else if (warpOutProgress) {
    speed = Math.max(0, speed - warpDeceleration * deltaTime);
    if (speed <= 0) {
      speed = 0;
      warpOutProgress = false;
      showWarpMessage(null);
    }
  } else {
    if (isSuperAccelerating) {
      speed = Math.min(maxSpeed, speed + superAcceleration * deltaTime);
    }
    if (isSuperDecelerating) {
      speed = Math.max(0, speed - superDeceleration * deltaTime);
    }
    if (keysPressed['up']) {
      speed = Math.min(maxSpeed, speed + normalAcceleration * deltaTime);
    }
    if (keysPressed['down']) {
      speed = Math.max(-100, speed - normalAcceleration * deltaTime);
    }
  }
}

function onKeyDown(event) {
  keysPressed[event.key.toLowerCase()] = true;
  if (event.code === 'ArrowUp') {
    keysPressed['up'] = true;
  } else if (event.code === 'ArrowDown') {
    keysPressed['down'] = true;
  } else if (event.code === 'KeyP') {
    paused = !paused;
    showPausedMessage(paused);
    clock.getDelta();
  } else if (event.code === 'Enter' && event.shiftKey) {
    if (!warpInProgress) {
      isWarping = true;
      warpInProgress = true;
      warpOutProgress = false;
      showWarpMessage('Warp Engaged');
    }
  } else if (event.code === 'Space' && event.shiftKey) {
    if (!warpOutProgress) {
      warpOutProgress = true;
      warpInProgress = false;
      isWarping = false;
      showWarpMessage('Warp Disengaged');
    }
  } else if (event.code === 'Enter' && !event.shiftKey) {
    isSuperAccelerating = true;
  } else if (event.code === 'Space' && !event.shiftKey) {
    isSuperDecelerating = true;
  }

  if (event.key.toLowerCase() === 'c') {
    const overlay = document.getElementById("overlay");
    const display = window.getComputedStyle(overlay).display;
    if (display === "none") {
      overlay.style.display = "block";
    } else {
      overlay.style.display = "none";
    }
  }
}

function onKeyUp(event) {
  keysPressed[event.key.toLowerCase()] = false;
  if (event.code === 'ArrowUp') {
    keysPressed['up'] = false;
  } else if (event.code === 'ArrowDown') {
    keysPressed['down'] = false;
  } else if (event.code === 'Enter' && !event.shiftKey) {
    isSuperAccelerating = false;
  } else if (event.code === 'Space' && !event.shiftKey) {
    isSuperDecelerating = false;
  }
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  mousePixelX = event.clientX;
  mousePixelY = event.clientY;
}
