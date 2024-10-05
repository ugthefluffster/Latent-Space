const clock = new THREE.Clock();

const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

let scene, camera, renderer;
let spaceship;
let asteroids = [];
let stars = [];
let gimbalScene, gimbalCamera, gimbalRenderer, gimbalSphere;
let gimbalAxisMarkers = {
  x: { positive: null, negative: null },
  y: { positive: null, negative: null },
  z: { positive: null, negative: null }
};

let speed = 0;
let isWarping = false;
let warpInProgress = false;
let warpOutProgress = false;
let isSuperAccelerating = false;
let isSuperDecelerating = false;

let spaceshipPosition = new Array(numberOfDimensions).fill(0);
let axisToDimension = { x: 0, y: 1, z: 2 };

let keysPressed = {};
let paused = false;

let mouse = new THREE.Vector2();
let mousePixelX = 0;
let mousePixelY = 0;

let targetObject = null;
let goalAchieved = false;

let isDimensionShifting = false;
let dimensionShiftStartTime = 0;
let shiftAxis = null;
let oldDimension = null;
let newDimension = null;
let oldQuaternion = null;
let newQuaternion = null;
let oldAxisToDimension = null;
let newAxisToDimension = null;
let controlsEnabled = true;

init();
animate();

async function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000000
  );
  camera.position.set(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  let geometry = new THREE.ConeGeometry(0.5, 1, 32);
  let material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  spaceship = new THREE.Mesh(geometry, material);
  spaceship.visible = false;
  scene.add(spaceship);
  initGimbal();
  const existingUUID = localStorage.getItem('gameUUID');
  if (existingUUID) {
    console.log('UUID found:', existingUUID);
    await loadGameProgress();
  } else {
    try {
      const uuid = await registerNewGameAPI();
      console.log('Game registered with UUID:', uuid);
      localStorage.setItem('gameUUID', uuid);
    } catch (error) {
      console.log('Register failed, defaulting to local initialization');
    }
  }
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  document.addEventListener('mousemove', onMouseMove, false);
  document.getElementById('save-button').addEventListener('click', function () {
    saveGameProgress();
  });
  document.getElementById('reset-button').addEventListener('click', function () {
    resetGame();
  });
  document.querySelectorAll('.axis').forEach(axisElement => {
    axisElement.addEventListener('click', onAxisClick);
  });
  for (let i = 0; i < totalNumbersOfAsteroids; i++) {
    createAsteroid();
  };
  createStars();
  if (!targetObject) {
    pickRandomTarget();
  }
  updateAxisLabelsAndColors();
}

function animate() {
  requestAnimationFrame(animate);
  let deltaTime = clock.getDelta();

  if (!paused) {
    if (isDimensionShifting) {
      asteroids.forEach((asteroid) => {
        asteroid.visible = false;
      })
      let elapsed = clock.getElapsedTime() - dimensionShiftStartTime;
      let t = Math.min(elapsed / dimensionShiftDuration, 1);
      spaceship.quaternion.slerpQuaternions(oldQuaternion, newQuaternion, t);
      updateSceneObjects(t);
      gimbalSphere.quaternion.copy(spaceship.quaternion.clone().invert());
      if (t >= 1) {
        isDimensionShifting = false;
        controlsEnabled = true;
        axisToDimension = { ...newAxisToDimension };
        updateAxisLabelsAndColors();
        updateGimbalAxisColors();
        stars.forEach((star) => {
          delete star.initialPosition3D;
          delete star.finalPosition3D;
        });
      }
    } else {
      if (controlsEnabled) {
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

        let direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(spaceship.quaternion);
        direction.multiplyScalar(speed * deltaTime);
        spaceship.position.add(direction);
        spaceshipPosition[axisToDimension.x] += direction.x;
        spaceshipPosition[axisToDimension.y] += direction.y;
        spaceshipPosition[axisToDimension.z] += direction.z;
        camera.position.copy(spaceship.position);
        camera.quaternion.copy(spaceship.quaternion);

        asteroids.forEach(function (asteroid) {
          asteroid.visible = true;
          let distance = asteroid.position.distanceTo(spaceship.position);
          if (distance > asteroidResetDistance) {
            resetAsteroidPosition(asteroid);
          }
        });
      }

      updateSceneObjects();
      gimbalSphere.quaternion.copy(spaceship.quaternion.clone().invert());
    }

    if (targetObject && !goalAchieved) {
      const objPosition = targetObject.mesh.position.clone();
      const screenPos = projectToScreen(objPosition);
      if (screenPos) {
        const cameraToObjDistance = objPosition.distanceTo(camera.position);
        const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
        const screenHeight = window.innerHeight;
        let projectedSize =
          (starSize / cameraToObjDistance) *
          (screenHeight / (2 * Math.tan(fov / 2)));
        if (projectedSize >= screenHeight * 0.2) {
          goalAchieved = true;
          updateGoalNotification()
        }
      }
    }

    updateSpeedometer();
    updateObjectInfo();
    updateCoordinates();
    renderer.render(scene, camera);
    gimbalRenderer.render(gimbalScene, gimbalCamera);
  }
}

function initGimbal() {
  gimbalScene = new THREE.Scene();
  gimbalCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
  gimbalCamera.position.set(0, 0, 5);
  gimbalCamera.lookAt(0, 0, 0);
  const gimbalCanvas = document.getElementById('gimbal-canvas');
  gimbalRenderer = new THREE.WebGLRenderer({ alpha: true, canvas: gimbalCanvas });
  gimbalRenderer.setSize(200, 200);
  gimbalRenderer.setClearColor(0x000000, 0);
  const geometry = new THREE.SphereGeometry(1, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true });
  gimbalSphere = new THREE.Mesh(geometry, material);
  gimbalScene.add(gimbalSphere);

  const sphereMarkerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const pyramidGeometry = new THREE.ConeGeometry(0.15, 0.3, 4);

  const xPositiveMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.x] });
  const xNegativeMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.x] });
  const xPositiveMarker = new THREE.Mesh(pyramidGeometry, xPositiveMaterial);
  xPositiveMarker.position.set(1, 0, 0);
  xPositiveMarker.rotation.z = -Math.PI / 2;
  const xNegativeMarker = new THREE.Mesh(sphereMarkerGeometry, xNegativeMaterial);
  xNegativeMarker.position.set(-1, 0, 0);
  gimbalSphere.add(xPositiveMarker);
  gimbalSphere.add(xNegativeMarker);
  gimbalAxisMarkers.x.positive = xPositiveMarker;
  gimbalAxisMarkers.x.negative = xNegativeMarker;

  const yPositiveMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.y] });
  const yNegativeMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.y] });
  const yPositiveMarker = new THREE.Mesh(pyramidGeometry, yPositiveMaterial);
  yPositiveMarker.position.set(0, 1, 0);
  const yNegativeMarker = new THREE.Mesh(sphereMarkerGeometry, yNegativeMaterial);
  yNegativeMarker.position.set(0, -1, 0);
  gimbalSphere.add(yPositiveMarker);
  gimbalSphere.add(yNegativeMarker);
  gimbalAxisMarkers.y.positive = yPositiveMarker;
  gimbalAxisMarkers.y.negative = yNegativeMarker;

  const zPositiveMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.z] });
  const zNegativeMaterial = new THREE.MeshBasicMaterial({ color: dimensionColors[axisToDimension.z] });
  const zPositiveMarker = new THREE.Mesh(pyramidGeometry, zPositiveMaterial);
  zPositiveMarker.position.set(0, 0, 1);
  zPositiveMarker.rotation.x = Math.PI / 2;
  const zNegativeMarker = new THREE.Mesh(sphereMarkerGeometry, zNegativeMaterial);
  zNegativeMarker.position.set(0, 0, -1);
  gimbalSphere.add(zPositiveMarker);
  gimbalSphere.add(zNegativeMarker);
  gimbalAxisMarkers.z.positive = zPositiveMarker;
  gimbalAxisMarkers.z.negative = zNegativeMarker;

  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.2, -0.2);
  arrowShape.lineTo(0, 0.2);
  arrowShape.lineTo(0.2, -0.2);
  arrowShape.lineTo(0.1, -0.2);
  const arrowExtrudeSettings = {
    steps: 1,
    depth: 0.02,
    bevelEnabled: false
  };
  const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, arrowExtrudeSettings);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
  arrowMesh.rotation.x = Math.PI / 3;
  arrowMesh.position.set(0, 0, 0);

  gimbalScene.add(arrowMesh);
}

function createAsteroid(position) {
  size = asteroidSize
  let geometry = new THREE.DodecahedronGeometry(size);
  let material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(Math.random(), Math.random(), Math.random())
  });
  let asteroid = new THREE.Mesh(geometry, material);
  if (position) {
    let position3D = get3DPosition(position);
    asteroid.position.copy(position3D);
  } else {
    resetAsteroidPosition(asteroid);
  }
  scene.add(asteroid);
  asteroids.push(asteroid);
  return asteroid;
}

function createStars() {
  for (let i = 0; i < totalNumberOfStars; i++) {
    createStar();
  }
}

function createStar(position) {
  size = starSize;
  let geometry = new THREE.BoxGeometry(size, size, size);
  let material = whiteMaterial;
  let star = new THREE.Mesh(geometry, material);
  star.userData = {
    hasTexture: false,
    textureRequested: false,
    originalMaterial: material,
    textureMaterial: null
  };
  if (position) {
    star.position.copy(get3DPosition(position));
    star.positionND = position.slice();
  } else {
    let positionND = new Array(numberOfDimensions).fill(0);
    let u = Math.random();
    let radius = Math.pow(u * (Math.pow(starDistanceMax, 3) - Math.pow(starDistanceMin, 3)) + Math.pow(starDistanceMin, 3), 1 / 3);
    let phi = Math.acos(2 * Math.random() - 1);
    let theta = 2 * Math.PI * Math.random();
    positionND[axisToDimension.x] = radius * Math.sin(phi) * Math.cos(theta);
    positionND[axisToDimension.y] = radius * Math.sin(phi) * Math.sin(theta);
    positionND[axisToDimension.z] = radius * Math.cos(phi);
    for (let dim = 0; dim < numberOfDimensions; dim++) {
      if (!Object.values(axisToDimension).includes(dim)) {
        positionND[dim] = (Math.random() - 0.5) * starDistanceMax;
      }
    }
    star.position.copy(get3DPosition(positionND));
    star.positionND = positionND.slice();
  }

  scene.add(star);
  stars.push({
    mesh: star,
    position: star.positionND,
    userData: star.userData
  });
  return star;
}

function pickRandomTarget() {

  // // for debuggging, create a close star and pick it as target
  // const debugPositionND = new Array(numberOfDimensions).fill(10000);
  // const debugStarMesh = createStar(debugPositionND);
  // const debugStarData = stars.find(obj => obj.mesh === debugStarMesh);
  // targetObject = debugStarData;

  targetObject = stars[Math.floor(Math.random() * stars.length)];

  updateGoalNotification();
  goalAchieved = false;
}

async function saveGameProgress() {
  const gameData = {
    spaceship: {
      position: spaceshipPosition.slice(),
      orientation: spaceship.quaternion.toArray()
    },
    goal: {
      position: targetObject ? targetObject.position.slice() : null
    },
    goalAchieved: goalAchieved,
    axisToDimension: { ...axisToDimension },
    objects: stars.map(obj => ({
      position: obj.position.slice(),
    })),
  };
  try {
    const uuid = localStorage.getItem('gameUUID');
    const saveConfirmation = await saveGameAPI(uuid, gameData);
    console.log('Game saved to backend:', saveConfirmation);
    showSaveMessage();
  } catch (error) {
    console.error('Save to backend failed, falling back to local save.');
    try {
      localStorage.setItem('spaceshipData', JSON.stringify(gameData));
      showSaveMessage();
    } catch (e) {
      console.error('Failed to save game locally:', e);
      alert('Failed to save game locally.');
    }
  }
}

async function loadGameProgress() {
  const uuid = localStorage.getItem('gameUUID');
  if (uuid) {
    try {
      const data = await loadGameAPI(uuid);
      console.log('Game loaded from backend:', data);

      if (data.spaceship) {
        const { position, orientation } = data.spaceship;
        spaceshipPosition = position.slice();
        spaceship.quaternion.fromArray(orientation);
        camera.quaternion.copy(spaceship.quaternion);
      }
      if (data.axisToDimension) {
        axisToDimension = { ...data.axisToDimension };
        updateAxisLabelsAndColors();
        updateGimbalAxisColors();
      }
      if (data.objects && Array.isArray(data.objects)) {
        data.objects.forEach(objData => {
          createStar(objData.position);
        });
      }
      if (data.goal && data.goal.position) {
        const position = data.goal.position;
        targetObject = stars.find(obj => {
          return obj.position.every((val, index) => val === position[index]);
        });

        if (targetObject) {
          goalAchieved = data.goalAchieved || false;
          updateGoalNotification();
        } else {
          console.warn("Target object not found after loading.");
        }
      }
      return;
    } catch (error) {
      console.error('Load from backend failed, falling back to local load.');
    }
  }

  const savedData = localStorage.getItem('spaceshipData');
  if (savedData) {
    const data = JSON.parse(savedData);
    if (data.spaceship) {
      const { position, orientation } = data.spaceship;
      spaceshipPosition = position.slice();
      spaceship.quaternion.fromArray(orientation);
      camera.quaternion.copy(spaceship.quaternion);
    }
    if (data.axisToDimension) {
      axisToDimension = { ...data.axisToDimension };
      updateAxisLabelsAndColors();
      updateGimbalAxisColors();
    }
    if (data.objects && Array.isArray(data.objects)) {
      data.objects.forEach(objData => {
        createStar(objData.position);
      });
    }
    if (data.goal && data.goal.position) {
      const position = data.goal.position;
      targetObject = stars.find(obj => {
        return obj.position.every((val, index) => val === position[index]);
      });
      if (targetObject) {
        goalAchieved = data.goalAchieved || false;
        updateGoalNotification(); // Ensure this function is called
      } else {
        console.warn("Target object not found after loading.");
      }
    }
  } else {
    spaceshipPosition = new Array(numberOfDimensions).fill(0);
    spaceship.quaternion.set(0, 0, 0, 1);
    camera.position.copy(spaceship.position);
  }
}

async function resetGame() {
  localStorage.removeItem('spaceshipData');
  spaceshipPosition = new Array(numberOfDimensions).fill(0);
  spaceship.rotation.set(0, 0, 0);
  spaceship.quaternion.set(0, 0, 0, 1);
  camera.position.copy(spaceship.position);
  camera.quaternion.copy(spaceship.quaternion);
  gimbalSphere.quaternion.copy(spaceship.quaternion.clone().invert());
  updateCoordinates();
  axisToDimension = { x: 0, y: 1, z: 2 };
  updateAxisLabelsAndColors();
  updateGimbalAxisColors();
  clearStars();
  createStars();
  asteroids.forEach(function (asteroid) {
    resetAsteroidPosition(asteroid);
  });
  speed = 0;
  goalAchieved = false;
  updateSpeedometer();
  showWarpMessage(null);
  showPausedMessage(false);
  pickRandomTarget();
  const uuid = localStorage.getItem('gameUUID');
  showResetMessage();
  if (uuid) {
    localStorage.removeItem('gameUUID');
    try {
      const resetConfirmation = await resetGameAPI(uuid);
      console.log('Game reset on backend:', resetConfirmation);
    } catch (error) {
      console.error('Reset on backend failed, falling back to local reset.');
    }
  }
  try {
    const uuid = await registerNewGameAPI();
    console.log('Game registered with UUID:', uuid);
    localStorage.setItem('gameUUID', uuid);
  } catch (error) {
    console.log('Register failed, defaulting to local initialization');
  }
}

function clearStars() {
  function disposeObject(obj) {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(material => material.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }
  stars.forEach(objData => {
    let obj = objData.mesh;
    scene.remove(obj);
    disposeObject(obj);
    if (obj.children && obj.children.length > 0) {
      obj.children.forEach(child => {
        disposeObject(child);
      });
    }
  });
  stars = [];
}

function resetAsteroidPosition(asteroid) {
  let position = new THREE.Vector3();
  position.copy(spaceship.position);
  let radius = 1000 + Math.random() * 2000;
  let phi = Math.acos(2 * Math.random() - 1);
  let theta = 2 * Math.PI * Math.random();
  position.x += radius * Math.sin(phi) * Math.cos(theta);
  position.y += radius * Math.sin(phi) * Math.sin(theta);
  position.z += radius * Math.cos(phi);
  asteroid.position.copy(position);
}

function projectToScreen(position) {
  let vector = position.clone().project(camera);
  if (vector.z > 1 || vector.z < -1) {
    return null;
  }
  let x = (vector.x + 1) / 2 * window.innerWidth;
  let y = (-vector.y + 1) / 2 * window.innerHeight;
  return new THREE.Vector2(x, y);
}

function updateObjectInfo() {
  const minHoverSize = 30;
  const maxHoverSize = 60;
  const objectInfo = document.getElementById('object-info');
  objectInfo.innerHTML = '';
  let hoveredObjects = [];

  for (let objData of stars) {
    let obj = objData.mesh;
    if (!obj.visible) continue;
    let objPosition = obj.position.clone();
    let screenPos = projectToScreen(objPosition);
    if (!screenPos) continue;
    const cameraToObjDistance = obj.position.distanceTo(spaceship.position);
    const fov = camera.fov * (Math.PI / 180);
    const size = starSize;
    const screenHeight = window.innerHeight;
    let projectedSize =
      (size / cameraToObjDistance) *
      (screenHeight / (2 * Math.tan(fov / 2)));
    let hoverRadius = Math.max(Math.min(projectedSize, maxHoverSize), minHoverSize / 2);
    let left = screenPos.x - hoverRadius;
    let right = screenPos.x + hoverRadius;
    let top = screenPos.y - hoverRadius;
    let bottom = screenPos.y + hoverRadius;
    if (
      mousePixelX >= left &&
      mousePixelX <= right &&
      mousePixelY >= top &&
      mousePixelY <= bottom
    ) {
      let distance = obj.position.distanceTo(spaceship.position);
      hoveredObjects.push({ object: obj, distance: distance, data: objData });
    }
  }

  if (hoveredObjects.length > 0) {
    hoveredObjects.sort((a, b) => a.distance - b.distance);
    let closestObject = hoveredObjects[0].object;
    let closestDistance = hoveredObjects[0].distance;
    let data = hoveredObjects[0].data;
    const objPosition = data.position;
    let starInfoHTML = `Star<br>Distance: ${parseInt(closestDistance, 10)}<br>`;
    for (let dim = 0; dim < numberOfDimensions; dim++) {
      starInfoHTML += `D ${dim + 1}: ${parseInt(objPosition[dim], 10)}<br>`;
    }
    objectInfo.innerHTML = starInfoHTML;
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

function getDistanceFromSlice(starPositionND, t = null) {
  let distanceSquared = 0;
  let currentMapping = isDimensionShifting && t !== null ? newAxisToDimension : axisToDimension;
  for (let dim = 0; dim < numberOfDimensions; dim++) {
    if (!Object.values(currentMapping).includes(dim)) {
      let delta = starPositionND[dim] - spaceshipPosition[dim];
      distanceSquared += delta * delta;
    }
  }
  return Math.sqrt(distanceSquared);
}

function updateStarVisibility(starData, distanceFromSlice) {
  if (distanceFromSlice < sliceThickness) {
    starData.mesh.visible = true;

    // Calculate perspective scaling based on distance in unmapped dimensions
    let scaleFactor = perspectiveFactor / (perspectiveFactor + distanceFromSlice);

    // Apply the perspective scaling to the star's size
    starData.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

  } else {
    starData.mesh.visible = false;
  }
}

function initiateDimensionShift(axis, targetDimension) {
  if (isDimensionShifting) return;
  isDimensionShifting = true;
  dimensionShiftStartTime = clock.getElapsedTime();
  shiftAxis = axis;
  oldDimension = axisToDimension[axis];
  newDimension = targetDimension;
  controlsEnabled = false;
  oldQuaternion = spaceship.quaternion.clone();
  oldAxisToDimension = { ...axisToDimension };
  newAxisToDimension = { ...axisToDimension };
  newAxisToDimension[axis] = newDimension;
  let rotationAxis = new THREE.Vector3();
  if (axis === 'x') {
    rotationAxis.set(0, 0, 1);
  } else if (axis === 'y') {
    rotationAxis.set(1, 0, 0);
  } else if (axis === 'z') {
    rotationAxis.set(0, 1, 0);
  }
  let angle = Math.PI / 2;
  let quaternionRotation = new THREE.Quaternion();
  quaternionRotation.setFromAxisAngle(rotationAxis, angle);
  newQuaternion = oldQuaternion.clone().multiply(quaternionRotation);
}

function updateSceneObjects(t = null) {
  stars.forEach((starData) => {
    let positionND = starData.position.slice();
    let position3D = new THREE.Vector3();

    if (isDimensionShifting && t !== null) {
      if (!starData.initialPosition3D) {
        starData.initialPosition3D = new THREE.Vector3(
          positionND[oldAxisToDimension.x],
          positionND[oldAxisToDimension.y],
          positionND[oldAxisToDimension.z]
        );

        starData.finalPosition3D = new THREE.Vector3(
          positionND[newAxisToDimension.x],
          positionND[newAxisToDimension.y],
          positionND[newAxisToDimension.z]
        );
      }
      position3D.lerpVectors(starData.initialPosition3D, starData.finalPosition3D, t);
      let distanceFromSlice = getDistanceFromSlice(positionND, t);
      updateStarVisibility(starData, distanceFromSlice);
    } else {
      position3D = get3DPosition(positionND);
      let distanceFromSlice = getDistanceFromSlice(positionND);
      updateStarVisibility(starData, distanceFromSlice);
      let distanceInMappedDimensions = starData.mesh.position.distanceTo(spaceship.position);
      if (distanceInMappedDimensions < textureDistance) {
        if (!starData.userData.hasTexture && !starData.userData.textureRequested) {
          starData.userData.textureRequested = true;
          fetchStarTexture(starData).catch((error) => {
            console.error(`Failed to load texture for star at position ${starData.position}:`, error);
          });
        }
        if (starData.userData.hasTexture && starData.mesh.material !== starData.userData.textureMaterial) {
          starData.mesh.material = starData.userData.textureMaterial;
        }
      } else {
        if (starData.userData.hasTexture && starData.mesh.material !== starData.userData.originalMaterial) {
          starData.mesh.material = starData.userData.originalMaterial;
        }
        starData.userData.textureRequested = false;
        if (starData.userData.abortController) {
          starData.userData.abortController.abort();
          delete starData.userData.abortController;
        }
      }
    }
    starData.mesh.position.copy(position3D);
  });

  const spaceshipPosition3D = get3DPosition(spaceshipPosition);
  spaceship.position.copy(spaceshipPosition3D);
}

async function fetchStarTexture(starData) {
  try {
    const uuid = localStorage.getItem('gameUUID');
    const abortController = new AbortController();
    starData.userData.abortController = abortController;
    const textureBlob = await fetchStarTextureAPI(uuid, starData.position, abortController.signal);
    const textureURL = URL.createObjectURL(textureBlob);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      textureURL,
      function (texture) {
        const textureMaterial = new THREE.MeshBasicMaterial({ map: texture });
        starData.userData.textureMaterial = textureMaterial;
        starData.userData.hasTexture = true;
        starData.mesh.material = textureMaterial;
      },
      undefined,
      function (err) {
        console.error(`Error loading texture for star at position ${starData.position}:`, err);
      }
    );
  } catch (error) {
    console.error(`Failed to fetch texture for star at position ${starData.position}:`, error);
  }
}



function get3DPosition(positionND) {
  return new THREE.Vector3(
    positionND[axisToDimension.x],
    positionND[axisToDimension.y],
    positionND[axisToDimension.z]
  );
}

function updateCoordinates() {
  const x = spaceshipPosition[axisToDimension.x].toFixed(2);
  const y = spaceshipPosition[axisToDimension.y].toFixed(2);
  const z = spaceshipPosition[axisToDimension.z].toFixed(2);
  document.getElementById('coordinate-x').textContent = `X(${axisToDimension.x + 1}): ${x}`;
  document.getElementById('coordinate-y').textContent = `Y(${axisToDimension.y + 1}): ${y}`;
  document.getElementById('coordinate-z').textContent = `Z(${axisToDimension.z + 1}): ${z}`;
}

function showWarpMessage(message) {
  const warpMessage = document.getElementById('warp-message');
  if (message) {
    warpMessage.textContent = message;
    warpMessage.style.display = 'block';
  } else {
    warpMessage.style.display = 'none';
  }
}

function updateSpeedometer() {
  const speedBar = document.getElementById('speed-bar');
  const speedText = document.getElementById('speed-text');
  let speedPercent = (speed / maxSpeed) * 100;
  speedBar.style.width = speedPercent + '%';
  speedText.textContent = 'Speed: ' + speed.toFixed(1) + ' km/s';
}

function showPausedMessage(show) {
  const pausedMessage = document.getElementById('paused-message');
  pausedMessage.style.display = show ? 'block' : 'none';
}

function showSaveMessage() {
  const saveMessage = document.getElementById('save-message');
  saveMessage.style.display = 'block';
  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 2000);
}

function showResetMessage() {
  const saveMessage = document.getElementById('reset-message');
  saveMessage.style.display = 'block';
  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 2000);
}

function updateGoalNotification() {
  const goalNotification = document.getElementById('goal-notification');
  if (goalAchieved) {
    goalNotification.innerHTML = `Congratulations! You have found the star.<br>You can reset the game to start a new hunt.`;
  } else if (targetObject) {
    let goalText = 'Goal: Find the star<br><small>';
    for (let dim = 0; dim < numberOfDimensions; dim++) {
      goalText += `Dim ${dim + 1}: ${Math.round(targetObject.position[dim])}`;
      if (dim < numberOfDimensions - 1) goalText += ', ';
    }
    goalText += '</small>';
    goalNotification.innerHTML = goalText;
  } else {
    goalNotification.innerHTML = 'Goal: Find the star';
  }
}


function updateAxisLabelsAndColors() {
  const xAxisElement = document.getElementById('coordinate-x');
  xAxisElement.textContent = `X(${axisToDimension.x + 1}): ${spaceshipPosition[axisToDimension.x].toFixed(2)}`;
  xAxisElement.style.color = dimensionColors[axisToDimension.x];

  const yAxisElement = document.getElementById('coordinate-y');
  yAxisElement.textContent = `Y(${axisToDimension.y + 1}): ${spaceshipPosition[axisToDimension.y].toFixed(2)}`;
  yAxisElement.style.color = dimensionColors[axisToDimension.y];

  const zAxisElement = document.getElementById('coordinate-z');
  zAxisElement.textContent = `Z(${axisToDimension.z + 1}): ${spaceshipPosition[axisToDimension.z].toFixed(2)}`;
  zAxisElement.style.color = dimensionColors[axisToDimension.z];
}

function updateGimbalAxisColors() {
  const xColor = new THREE.Color(dimensionColors[axisToDimension.x]);
  gimbalAxisMarkers.x.positive.material.color.copy(xColor);
  gimbalAxisMarkers.x.negative.material.color.copy(xColor);

  const yColor = new THREE.Color(dimensionColors[axisToDimension.y]);
  gimbalAxisMarkers.y.positive.material.color.copy(yColor);
  gimbalAxisMarkers.y.negative.material.color.copy(yColor);

  const zColor = new THREE.Color(dimensionColors[axisToDimension.z]);
  gimbalAxisMarkers.z.positive.material.color.copy(zColor);
  gimbalAxisMarkers.z.negative.material.color.copy(zColor);
}

function onAxisClick(event) {
  const axis = event.target.getAttribute('data-axis');
  showDimensionSelectionMenu(axis);
}

document.getElementById('dimension-selection-menu').addEventListener('click', (event) => {
  if (event.target.id === 'dimension-selection-menu') {
    event.target.style.display = 'none';
  }
});

function showDimensionSelectionMenu(axis) {
  const menu = document.getElementById('dimension-selection-menu');
  const dimensionList = document.getElementById('dimension-list');
  const selectedAxisSpan = document.getElementById('selected-axis');
  selectedAxisSpan.textContent = axis.toUpperCase();
  dimensionList.innerHTML = '';
  const mappedDimensions = Object.values(axisToDimension);
  for (let i = 0; i < numberOfDimensions; i++) {
    if (!mappedDimensions.includes(i)) {
      const li = document.createElement('li');
      li.textContent = `Dimension ${i + 1}`;
      li.setAttribute('data-dimension', i);
      li.style.color = dimensionColors[i];
      li.addEventListener('click', () => {
        initiateDimensionShift(axis, i);
        menu.style.display = 'none';
      });
      dimensionList.appendChild(li);
    }
  }
  menu.style.display = 'block';
}

window.addEventListener('resize', function () {
  let width = window.innerWidth;
  let height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});