async function registerNewGameAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to register new game: ${response.statusText}`);
    }

    const data = await response.json();
    const uuid = data.uuid;

    return uuid;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function saveGameAPI(uuid, gameData) {
  try {
    const response = await fetch(`${API_BASE_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid, gameData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save game: ${response.statusText}`);
    }

    const data = await response.json();
    return data.confirmation;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function loadGameAPI(uuid) {
  try {
    const response = await fetch(`${API_BASE_URL}/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid }),
    });

    if (!response.ok) {
      throw new Error(`Failed to load game: ${response.statusText}`);
    }

    const data = await response.json();
    const gameData = data.gameData;
    return gameData;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function resetGameAPI(uuid) {
  try {
    const response = await fetch(`${API_BASE_URL}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reset game: ${response.statusText}`);
    }

    const data = await response.json();


    return data.confirmation;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function fetchStarTextureAPI(uuid, starPosition, signal = null, retries = 1, delay = 3000) {
  let attempts = 0;

  while (retries === -1 || attempts < retries) {
    try {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuid: uuid, position: starPosition })
      };

      if (signal) {
        fetchOptions.signal = signal;
      }

      const response = await fetch(`${API_BASE_URL}/getStarTexture`, fetchOptions);

      if (response.status === 503) {
        console.log(`Server is busy, retrying after ${delay}ms... (Attempt ${attempts + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch star texture: ${response.statusText}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      if (signal && signal.aborted) {
        console.log(`Fetch for star at position ${starPosition} was aborted.`);
        return;
      }
      console.error(`Error fetching star texture at position ${starPosition}:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }
  }

  throw new Error(`Failed to fetch star texture after ${attempts} attempts`);
}


async function getPromptAPI() {
  const uuid = localStorage.getItem('gameUUID');
  if (!uuid) {
    console.error('No game UUID found.');
    promptStatus.textContent = 'Error: No game UUID found.';
    promptStatus.style.color = 'red';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/getPrompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid: uuid }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching prompt:', errorData.error);
      promptStatus.textContent = `Error: ${errorData.error}`;
      promptStatus.style.color = 'red';
      return;
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    console.error('Error fetching prompt:', error);
    promptStatus.textContent = 'Error fetching prompt.';
    promptStatus.style.color = 'red';
  }
}

async function setPromptAPI(newPrompt) {
  const uuid = localStorage.getItem('gameUUID');
  if (!uuid) {
    console.error('No game UUID found.');
    promptStatus.textContent = 'Error: No game UUID found.';
    promptStatus.style.color = 'red';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/setPrompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: newPrompt, uuid: uuid }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error setting prompt:', errorData.error);
      promptStatus.textContent = `Error: ${errorData.error}`;
      promptStatus.style.color = 'red';
      return;
    }

    const data = await response.json();
    console.log('Prompt set successfully:', data.confirmation);
    promptStatus.textContent = 'Prompt set successfully!';
    promptStatus.style.color = 'green';
  } catch (error) {
    console.error('Error setting prompt:', error);
    promptStatus.textContent = 'Error setting prompt.';
    promptStatus.style.color = 'red';
  }
}

async function setDirectionsAPI(descriptors, iterations = 300) {
  const uuid = localStorage.getItem('gameUUID');
  if (!uuid) {
    console.error('No game UUID found.');
    return; // Or handle the error as needed
  }

  try {
    const response = await fetch(`${API_BASE_URL}/setDirections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid, descriptors, iterations }),
    });

    if (!response.ok) {
      const errorData = await response.json(); // Try to parse error as JSON
      const errorMessage = errorData?.error || response.statusText;
      throw new Error(`Failed to set directions: ${errorMessage}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let progress = 0;
    let finished = false;


    while (!finished) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.substring(5);
          if (data === "100") {
            console.log("Directions set successfully!");
            finished = true;
          } else if (data === "error") {
            console.error("Error setting directions on the server.");
            finished = true;
          } else {
            progress = parseInt(data);
            directionProgress.value = progress; 
            progressText.textContent = `${progress}%`;
          }
        }
      }
    }
  } catch (error) {
    if (error.message.includes('NetworkError')) {
      showWarningMessage()
      serverFound = false
    }
    console.error('Error setting directions:', error);
    // Handle error, e.g., show an error message to the user
  }
}


const directionsModal = document.getElementById('directions-modal');
const descriptorsInput = document.getElementById('descriptors-input');
const directionProgress = document.getElementById('direction-progress');
const progressText = document.getElementById('progress-text');
const directionsStatus = document.getElementById('directions-status');


document.getElementById('set-directions-button').addEventListener('click', openDirectionsModal);
document.getElementById('close-directions-modal').addEventListener('click', closeDirectionsModal);
document.getElementById('send-directions-button').addEventListener('click', setDirections);

function openDirectionsModal() {
  paused = true;
  modalOpen = true;
  clearDescriptorsInput();
  addDescriptorInputs(); // Add the initial input pair
  addAddButton(); // Add the "+ Add" button
  directionsStatus.textContent = '';
  directionsModal.style.display = 'block';
}

function closeDirectionsModal() {
  directionsModal.style.display = 'none';
  modalOpen = false;
  paused = false;
  showPausedMessage(paused);
}

function addDescriptorInputs() {
  const inputPair = document.createElement('div');
  inputPair.classList.add('descriptor-pair'); // Add a class for easier selection later
  const input1 = document.createElement('input');
  input1.type = 'text';
  input1.placeholder = 'Negative word';
  const input2 = document.createElement('input');
  input2.type = 'text';
  input2.placeholder = 'Positive word';
  inputPair.appendChild(input1);
  inputPair.appendChild(input2);
  descriptorsInput.appendChild(inputPair);
}

function addAddButton() {
  const addButton = document.createElement('button');
  addButton.textContent = '+ Add';
  addButton.addEventListener('click', addDescriptorInputs); // Add more inputs when clicked
  descriptorsInput.appendChild(addButton);
}

function clearDescriptorsInput() {
  descriptorsInput.innerHTML = '';
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
    const response = await fetch(`${API_BASE_URL}/setDirections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Important: Keep the connection open to receive streaming data
        'Cache-Control': 'no-cache',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({ uuid: localStorage.getItem('gameUUID'), descriptors }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData?.error || response.statusText;
      throw new Error(`Failed to set directions: ${errorMessage}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedText += decoder.decode(value, { stream: true });

      let lines = receivedText.split('\n\n');
      // Keep the last partial line (if any) for the next chunk
      receivedText = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.substring(5).trim();

          if (data === 'error') {
            directionsStatus.textContent = 'Error setting directions.';
            directionsStatus.style.color = 'red';
            return;
          } else {
            const progress = parseInt(data);
            if (!isNaN(progress)) {
              directionProgress.value = progress;
              progressText.textContent = `${progress}%`;

              if (progress >= 100) {
                directionsStatus.textContent = 'Directions set successfully!';
                directionsStatus.style.color = 'green';
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error setting directions:', error);
    directionsStatus.textContent = `Error: ${error.message}`;
    directionsStatus.style.color = 'red';
  }
}
