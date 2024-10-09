function controlShip(deltaTime) {
  const rotationKeys = {
    'w': ['rotateX', rotationSpeed],
    's': ['rotateX', -rotationSpeed],
    'a': ['rotateY', rotationSpeed],
    'd': ['rotateY', -rotationSpeed],
    'q': ['rotateZ', -rotationSpeed],
    'e': ['rotateZ', rotationSpeed]
  };

  for (let key in rotationKeys) {
    if (keysPressed[key]) {
      spaceship[rotationKeys[key][0]](rotationKeys[key][1]);
    }
  }

  if (warpInProgress) {
    speed = Math.min(maxSpeed, speed + warpAcceleration * deltaTime);
    if (speed >= maxSpeed) {
      warpInProgress = false;
      showWarpMessage('Warp Speed');
    }
  } else if (warpOutProgress) {
    speed = Math.max(0, speed - warpDeceleration * deltaTime);
    if (speed <= 0) {
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

function handleKey(event, isKeyDown) {
  if (modalOpen) {
    return;
  }
  const key = event.key.toLowerCase();
  keysPressed[key] = isKeyDown;

  switch (event.code) {
    case 'ArrowUp':
      keysPressed['up'] = isKeyDown;
      break;
    case 'ArrowDown':
      keysPressed['down'] = isKeyDown;
      break;
    case 'KeyP':
      if (isKeyDown) {
        paused = !paused;
        showPausedMessage(paused);
        clock.getDelta();
      }
      break;
    case 'Enter':
      if (event.shiftKey && isKeyDown) {
        if (!warpInProgress) {
          isWarping = warpInProgress = true;
          warpOutProgress = false;
          showWarpMessage('Warp Engaged');
        }
      } else {
        isSuperAccelerating = isKeyDown;
      }
      if (!isKeyDown && !event.shiftKey) {
        isSuperAccelerating = false;
      }
      break;
    case 'Space':
      if (event.shiftKey && isKeyDown) {
        if (!warpOutProgress) {
          warpOutProgress = true;
          warpInProgress = isWarping = false;
          showWarpMessage('Warp Disengaged');
        }
      } else {
        isSuperDecelerating = isKeyDown;
      }
      if (!isKeyDown && !event.shiftKey) {
        isSuperDecelerating = false;
      }
      break;
  }

  if (key === 'c' && isKeyDown) {
    const overlay = document.getElementById("overlay");
    overlay.style.display = overlay.style.display === "none" ? "block" : "none";
  }
}

document.addEventListener('keydown', event => handleKey(event, true), false);
document.addEventListener('keyup', event => handleKey(event, false), false);
document.addEventListener('mousemove', event => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  mousePixelX = event.clientX;
  mousePixelY = event.clientY;
}, false);
