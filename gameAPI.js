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
  const uuid = tempUUID || localStorage.getItem('gameUUID');
  if (!uuid) {
    return null;
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
      throw new Error(errorData.error);
    }

    const data = await response.json();
    return data.prompt;
  } catch (error) {
    throw error;
  }
}

async function setPromptAPI(newPrompt) {
  const uuid = tempUUID || localStorage.getItem('gameUUID');
  if (!uuid) {
    return false;
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
      throw new Error(errorData.error);
    }

    const data = await response.json();
    return true;
  } catch (error) {
    throw error;
  }
}

async function sendDirectionsAPI(uuid, descriptors, progressCallback) {
  const response = await fetch(`${API_BASE_URL}/setDirections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({ uuid, descriptors }),
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
    receivedText = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.substring(5).trim();
        if (data === 'error') {
          progressCallback('error');
          return;
        } else {
          const progress = parseInt(data);
          if (!isNaN(progress)) {
            progressCallback(progress);
          }
        }
      }
    }
  }
}