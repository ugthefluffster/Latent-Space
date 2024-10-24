const clock = new THREE.Clock();
const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const tempPosition3D = new THREE.Vector3();

tempUUID = null;

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
let targetImageURL = null;
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

let serverFound = false;
let modalOpen = false;

init();
animate();

async function init() {
  showLoadingMessage('loading');
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
  document.getElementById("overlay").style.display = "none";
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
      tempUUID = await registerNewGameAPI();
      console.log('New tempUUID registered:', tempUUID);
      serverFound = true;
    } catch (error) {
      console.error('Failed to register new game, server might be down:', error);
      tempUUID = null;
      serverFound = false;
    }
    spaceshipPosition = new Array(numberOfDimensions).fill(0);
    spaceship.quaternion.set(0, 0, 0, 1);
    camera.position.copy(spaceship.position);
  }
  
  document.addEventListener('keydown', event => handleKey(event, true), false);
  document.addEventListener('keyup', event => handleKey(event, false), false);
  document.addEventListener('mousemove', updateMousePosition, false);
  document.getElementById('save-button').addEventListener('click', saveGameProgress);
  document.getElementById('reset-button').addEventListener('click', resetGame);
  document.getElementById('set-directions-button').addEventListener('click', openDirectionsModal);
  document.getElementById('close-directions-modal').addEventListener('click', closeDirectionsModal);
  document.getElementById('send-directions-button').addEventListener('click', setDirections);
  document.getElementById('set-prompt-button').addEventListener('click', openPromptModal);
  document.querySelector('.close-button').addEventListener('click', closePromptModal);
  document.getElementById('send-prompt-button').addEventListener('click', handlePromptSubmit);
  document.querySelectorAll('.axis').forEach(axisElement => {
    axisElement.addEventListener('click', onAxisClick);
  });

  for (let i = 0; i < totalNumbersOfAsteroids; i++) {
    createAsteroid();
  };
  if (stars.length == 0) {
    createStars();
  }
  if (!targetObject) {
    pickRandomTarget();
  }
  updateAxisLabelsAndColors();
  showLoadingMessage('loaded');
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
        controlShip(deltaTime);
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
    let position3D = new THREE.Vector3();
    get3DPosition(position, position3D);
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
    get3DPosition(position, tempPosition3D);
    star.position.copy(tempPosition3D);
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
    get3DPosition(positionND, tempPosition3D);
    star.position.copy(tempPosition3D);
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

  // // function disabled for now

  // // for debuggging, create a close star and pick it as target
  // const debugPositionND = new Array(numberOfDimensions).fill(10000);
  // const debugStarMesh = createStar(debugPositionND);
  // const debugStarData = stars.find(obj => obj.mesh === debugStarMesh);
  // targetObject = debugStarData;


  // targetObject = stars[Math.floor(Math.random() * stars.length)];

  // goalAchieved = false;

  // fetchTargetImage(targetObject.position)
  //   .then(() => {
  //     updateGoalNotification();
  //   })
  //   .catch(error => {
  //     console.error('Failed to fetch target image:', error);
  //     updateGoalNotification();
  //   });
}

async function fetchTargetImage(position) {
  const uuid = tempUUID || localStorage.getItem('gameUUID');
  if (!uuid) {
    console.error('No game UUID found.');
    throw new Error('No game UUID found.');
  }
  try {
    const imageBlob = await fetchStarTextureAPI(uuid, position);
    targetImageURL = URL.createObjectURL(imageBlob);
  } catch (error) {
    console.error('Error fetching target image:', error);
    throw error;
  }
}

async function saveGameProgress() {
  showSaveMessage('saving');

  let uuid = tempUUID || localStorage.getItem('gameUUID');

  if (!uuid) {
    try {
      uuid = await registerNewGameAPI();
      serverFound = true;
      localStorage.setItem('gameUUID', uuid);
    } catch (error) {
      serverFound = false;
      showSaveMessage('done');
      return;
    }
  } else if (tempUUID) {
    localStorage.setItem('gameUUID', tempUUID);
  }

  const gameData = {
    spaceship: {
      position: spaceshipPosition.slice(),
      orientation: spaceship.quaternion.toArray(),
    },
    goal: {
      position: targetObject ? targetObject.position.slice() : null,
    },
    goalAchieved: goalAchieved,
    axisToDimension: { ...axisToDimension },
    objects: stars.map((obj) => ({
      position: obj.position.slice(),
    })),
  };

  try {
    await saveGameAPI(uuid, gameData);
    tempUUID = null;
    serverFound = true;
  } catch (error) {
    serverFound = false;
  }

  showSaveMessage('done');
}

async function loadGameProgress() {
  const uuid = localStorage.getItem('gameUUID');
  if (uuid) {
    try {
      const data = await loadGameAPI(uuid);
      serverFound = true;
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
          fetchTargetImage(targetObject.position)
            .then(() => {
              updateGoalNotification();
            })
            .catch(error => {
              console.error('Failed to fetch target image:', error);
              updateGoalNotification();
            });
        } else {
          console.warn("Target object not found after loading.");
        }
      }
    } catch (error) {
      serverFound = false;
      console.error('Failed to load game from backend:', error);
    }
  } else {
    spaceshipPosition = new Array(numberOfDimensions).fill(0);
    spaceship.quaternion.set(0, 0, 0, 1);
    camera.position.copy(spaceship.position);
  }
}

async function resetGame() {
  showResetMessage('resetting');
  await new Promise((resolve) => setTimeout(resolve, 0)); // Allow the reset message to display before continuing

  // Reset game state
  targetImageURL = null;
  targetObject = null;
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
  if (uuid) {
    try {
      const resetConfirmation = await resetGameAPI(uuid);
      serverFound = true;
      console.log('Game reset on backend:', resetConfirmation);
    } catch (error) {
      serverFound = false;
      console.error('Failed to reset game on backend:', error);
    }
    localStorage.removeItem('gameUUID');
    console.log('Game UUID removed from local storage');
  }

  try {
    tempUUID = await registerNewGameAPI();
    serverFound = true;
    console.log('New tempUUID registered:', tempUUID);
  } catch (error) {
    serverFound = false;
    console.error('Failed to register new game after reset:', error);
    tempUUID = null;
  }

  updateGoalNotification();
  showResetMessage('reset');
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

function getDistanceFromSlice(starPositionND, t = null) {
  let distanceSquared = 0;
  const currentMapping =
    isDimensionShifting && t !== null ? newAxisToDimension : axisToDimension;

  // Precompute mapped dimensions for faster lookup
  const mappedDimensions = new Set(Object.values(currentMapping));

  for (let dim = 0; dim < numberOfDimensions; dim++) {
    if (!mappedDimensions.has(dim)) {
      const delta = starPositionND[dim] - spaceshipPosition[dim];
      distanceSquared += delta * delta;
    }
  }
  return Math.sqrt(distanceSquared);
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
  // Reusable vectors
  const spaceshipPosition3D = new THREE.Vector3();
  const position3D = new THREE.Vector3(); // For star positions
  const tempVector = new THREE.Vector3(); // For temporary calculations if needed

  // Get the 3D position of the spaceship
  get3DPosition(spaceshipPosition, spaceshipPosition3D);
  spaceship.position.copy(spaceshipPosition3D);

  for (let i = 0; i < stars.length; i++) {
    const starData = stars[i];
    const positionND = starData.position; // Use directly without slicing

    // Early exit: approximate distance check to spaceship
    get3DPosition(positionND, position3D);
    const distanceSquared = position3D.distanceToSquared(spaceshipPosition3D);
    if (distanceSquared >= showStarDistance * showStarDistance) {
      starData.mesh.visible = false;
      continue;
    }

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
      position3D.lerpVectors(
        starData.initialPosition3D,
        starData.finalPosition3D,
        t
      );
    }

    // Compute distance from the slice
    const distanceFromSlice =
      isDimensionShifting && t !== null
        ? getDistanceFromSlice(positionND, t)
        : getDistanceFromSlice(positionND);

    // Check if the star is within the slice
    if (distanceFromSlice >= sliceThickness) {
      starData.mesh.visible = false;
      continue;
    }

    // Star is visible
    starData.mesh.visible = true;
    starData.mesh.position.copy(position3D);

    // Calculate perspective scaling based on distance in unmapped dimensions
    const scaleFactor =
      perspectiveFactor / (perspectiveFactor + distanceFromSlice);
    starData.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Handle texture logic if necessary
    const uuid = tempUUID || localStorage.getItem('gameUUID'); // needs fixing!
    if (distanceSquared < textureDistance * textureDistance && uuid) {
      if (!starData.userData.hasTexture && !starData.userData.textureRequested) {
        starData.userData.textureRequested = true;
        fetchStarTexture(starData).catch((error) => {
          console.error(
            `Failed to load texture for star at position ${starData.position}:`,
            error
          );
        });
      }
      if (
        starData.userData.hasTexture &&
        starData.mesh.material !== starData.userData.textureMaterial
      ) {
        starData.mesh.material = starData.userData.textureMaterial;
      }
    } else {
      if (
        starData.userData.hasTexture &&
        starData.mesh.material !== starData.userData.originalMaterial
      ) {
        starData.mesh.material = starData.userData.originalMaterial;
      }
      starData.userData.textureRequested = false;
      if (starData.userData.abortController) {
        starData.userData.abortController.abort();
        delete starData.userData.abortController;
      }
    }
  }
}

async function fetchStarTexture(starData) {
  try {
    const uuid = tempUUID || localStorage.getItem('gameUUID');
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

function get3DPosition(positionND, outVector) {
  outVector.set(
    positionND[axisToDimension.x],
    positionND[axisToDimension.y],
    positionND[axisToDimension.z]
  );
}

async function handlePromptModalOpen() {
  paused = true;
  modalOpen = true;
  promptStatus.textContent = '';
  const currentPrompt = await getPromptAPI();
  if (currentPrompt) {
    promptTextbox.value = currentPrompt;
  } else {
    promptTextbox.value = '';
  }
}

function handlePromptModalClose() {
  modalOpen = false;
  paused = false;
  showPausedMessage(paused);
}

async function handlePromptSubmit() {
  try {
    const newPrompt = promptTextbox.value.trim();
    if (newPrompt === '') {
      promptStatus.textContent = 'Prompt cannot be empty.';
      promptStatus.style.color = 'red';
      return;
    }
    const success = await setPromptAPI(newPrompt);
    if (success) {
      promptStatus.textContent = 'Prompt set successfully!';
      promptStatus.style.color = 'green';
    }
  } catch (error) {
    promptStatus.textContent = `Error: ${error.message}`;
    promptStatus.style.color = 'red';
  }
}

async function setDirections() {
  const descriptors = [];
  const inputPairs = descriptorsInput.querySelectorAll('.descriptor-pair');
  for (const pair of inputPairs) {
    const negativeWord = pair.children[0].value.trim();
    const positiveWord = pair.children[1].value.trim();
    if (!negativeWord || !positiveWord) {
      directionsStatus.textContent = 'All fields are required.';
      directionsStatus.style.color = 'red';
      return;
    }
    descriptors.push([negativeWord, positiveWord]);
  }
  if (descriptors.length < 4) {
    directionsStatus.textContent = 'At least 4 descriptors are required.';
    directionsStatus.style.color = 'red';
    return;
  }
  directionsStatus.textContent = 'Setting directions...';
  directionsStatus.style.color = 'black';
  directionProgress.value = 0;
  progressText.textContent = '0%';

  try {
    const uuid = tempUUID || localStorage.getItem('gameUUID');
    await sendDirectionsAPI(uuid, descriptors, (progress) => {
      if (progress === 'error') {
        directionsStatus.textContent = 'Error setting directions.';
        directionsStatus.style.color = 'red';
      } else {
        directionProgress.value = progress;
        progressText.textContent = `${progress}%`;
        if (progress >= 100) {
          directionsStatus.textContent = 'Directions set successfully!';
          directionsStatus.style.color = 'green';
        }
      }
    });
  } catch (error) {
    console.error('Error setting directions:', error);
    directionsStatus.textContent = `Error: ${error.message}`;
    directionsStatus.style.color = 'red';
  }
}