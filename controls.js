function controlShip(deltaTime) {
  updateShipRotation();
  if (!handleWarpSpeed(deltaTime)) {
    updateNormalSpeed(deltaTime);
  }
}

const ROTATION_CONTROLS = {
  w: ['rotateX', rotationSpeed],
  s: ['rotateX', -rotationSpeed],
  a: ['rotateY', rotationSpeed],
  d: ['rotateY', -rotationSpeed],
  q: ['rotateZ', -rotationSpeed],
  e: ['rotateZ', rotationSpeed]
};

function updateShipRotation() {
  Object.entries(ROTATION_CONTROLS).forEach(([key, [rotationAxis, rotationValue]]) => {
    if (keysPressed[key]) {
      spaceship[rotationAxis](rotationValue);
    }
  });
}

function handleWarpSpeed(deltaTime) {
  if (warpInProgress) {
    speed = Math.min(maxSpeed, speed + warpAcceleration * deltaTime);
    if (speed >= maxSpeed) {
      warpInProgress = false;
      showWarpMessage('Warp Speed');
    }
    return true;
  }
  if (warpOutProgress) {
    speed = Math.max(0, speed - warpDeceleration * deltaTime);
    if (speed <= 0) {
      warpOutProgress = false;
      showWarpMessage(null);
    }
    return true;
  }
  return false;
}

function updateNormalSpeed(deltaTime) {
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

function handleWarpEngagement(isEngaging) {
  if (isEngaging && !warpInProgress) {
    isWarping = warpInProgress = true;
    warpOutProgress = false;
    showWarpMessage('Warp Engaged');
  } else if (!isEngaging && !warpOutProgress) {
    warpOutProgress = true;
    warpInProgress = isWarping = false;
    showWarpMessage('Warp Disengaged');
  }
}

function handleKey(event, isKeyDown) {
  if (modalOpen) return;
  const key = event.key.toLowerCase();
  keysPressed[key] = isKeyDown;
  handleArrowKeys(event, isKeyDown);
  handleSpecialKeys(event, isKeyDown);
}

function handleArrowKeys(event, isKeyDown) {
  switch (event.code) {
    case 'ArrowUp':
      keysPressed['up'] = isKeyDown;
      break;
    case 'ArrowDown':
      keysPressed['down'] = isKeyDown;
      break;
  }
}

function handleSpecialKeys(event, isKeyDown) {
  switch (event.code) {
    case 'Enter':
      if (event.shiftKey && isKeyDown) {
        handleWarpEngagement(true);
      } else {
        isSuperAccelerating = isKeyDown && !event.shiftKey;
      }
      break;

    case 'Space':
      if (event.shiftKey && isKeyDown) {
        handleWarpEngagement(false);
      } else {
        isSuperDecelerating = isKeyDown && !event.shiftKey;
      }
      break;

    case 'KeyP':
      if (isKeyDown) {
        paused = !paused;
        showPausedMessage(paused);
        clock.getDelta();
      }
      break;

    case 'KeyC':
      if (isKeyDown) {
        const overlay = document.getElementById("overlay");
        overlay.style.display = overlay.style.display === "none" ? "block" : "none";
      }
      break;
  }
}

function updateMousePosition(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  mousePixelX = event.clientX;
  mousePixelY = event.clientY;
}