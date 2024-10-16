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

async function fetchStarTextureAPI(uuid, starPosition, signal = null, retries = 30, delay = 3000) {
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


