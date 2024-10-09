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

function projectToScreen(position) {
  let vector = position.clone().project(camera);
  if (vector.z > 1 || vector.z < -1) {
    return null;
  }
  let x = (vector.x + 1) / 2 * window.innerWidth;
  let y = (-vector.y + 1) / 2 * window.innerHeight;
  return new THREE.Vector2(x, y);
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

function showSaveMessage(status) {
  const saveMessage = document.getElementById('save-message');
  saveMessage.style.display = 'block';
  if (status === 'saving') {
    saveMessage.innerHTML = 'Saving Game...'
  }
  if (status === 'saved') {
    saveMessage.innerHTML = 'Game Saved!'
    setTimeout(() => {
      saveMessage.style.display = 'none';
      if (!serverFound) {
        showWarningMessage()
      }
    }, 2000);
  }
}

function showResetMessage(status) {
  const resetMessage = document.getElementById('reset-message');
  resetMessage.style.display = 'block';
  if (status === 'resetting') {
    resetMessage.innerHTML = 'Resetting Game...';
  }
  if (status === 'reset') {
    resetMessage.innerHTML = 'Game Reset!';
    setTimeout(() => {
      resetMessage.style.display = 'none';
      if (!serverFound) {
        showWarningMessage()
      }
    }, 2000);
  }
}

function showWarningMessage() {
  const saveMessage = document.getElementById('warning-message');
  saveMessage.style.display = 'block';
  setTimeout(() => {
    saveMessage.style.display = 'none';
  }, 2000);
}

function showLoadingMessage(status) {
  const saveMessage = document.getElementById('loading-message');
  if (status == 'loading') {
    saveMessage.style.display = 'block';
  }
  if (status == 'loaded') {
    setTimeout(() => {
      saveMessage.style.display = 'none';
      if (!serverFound) {
        showWarningMessage()
      }
    }, 2000);
  }
}

function updateGoalNotification() {
  const goalNotification = document.getElementById('goal-notification');

  if (goalAchieved) {
    let coordinatesText = `<div class="goal-coordinates"><small>`;
    for (let dim = 0; dim < numberOfDimensions; dim++) {
      coordinatesText += `Dim ${dim + 1}: ${Math.round(targetObject.position[dim])}`;
      if (dim < numberOfDimensions - 1) coordinatesText += ', ';
    }
    coordinatesText += `</small></div>`;

    goalNotification.innerHTML = `
      <div class="goal-title">Congratulations! You found the star!</div>
      ${targetImageURL ? `<img src="${targetImageURL}" alt="Target Image" class="goal-image">` : ''}
      <br>You can reset the game to start a new hunt.
    `;
  } else if (targetObject) {
    let coordinatesText = `<div class="goal-coordinates"><small>`;
    for (let dim = 0; dim < numberOfDimensions; dim++) {
      coordinatesText += `Dim ${dim + 1}: ${Math.round(targetObject.position[dim])}`;
      if (dim < numberOfDimensions - 1) coordinatesText += ', ';
    }
    coordinatesText += `</small></div>`;

    goalNotification.innerHTML = `
      <div class="goal-title">Find the Star</div>
      ${targetImageURL ? `<img src="${targetImageURL}" alt="Target Image" class="goal-image">` : ''}
      ${coordinatesText}
    `;
  } else {
    // goalNotification.innerHTML = 'Loading target...';
    goalNotification.innerHTML = '';
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

function onAxisClick(event) {
  if (!isDimensionShifting) {
    const axis = event.target.getAttribute('data-axis');
    showDimensionSelectionMenu(axis);
  }
}

function updateCoordinates() {
  const x = spaceshipPosition[axisToDimension.x].toFixed(2);
  const y = spaceshipPosition[axisToDimension.y].toFixed(2);
  const z = spaceshipPosition[axisToDimension.z].toFixed(2);
  document.getElementById('coordinate-x').textContent = `X(${axisToDimension.x + 1}): ${x}`;
  document.getElementById('coordinate-y').textContent = `Y(${axisToDimension.y + 1}): ${y}`;
  document.getElementById('coordinate-z').textContent = `Z(${axisToDimension.z + 1}): ${z}`;
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

window.addEventListener('resize', function () {
  let width = window.innerWidth;
  let height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});