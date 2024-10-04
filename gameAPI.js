// Function to register a new game and get a UUID
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

// Function to save game data
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
    return data.confirmation; // Assuming the backend sends a confirmation message
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to load game data
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

// Function to reset the game
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


    return data.confirmation; // Assuming the backend sends a confirmation message
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to fetch star texture
async function fetchStarTextureAPI(uuid, starPosition) {
  try {
    const response = await fetch(`${API_BASE_URL}/getStarTexture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uuid: uuid, position: starPosition }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch star texture: ${response.statusText}`);
    }

    const blob = await response.blob();
    return blob; // Return the image as a Blob
  } catch (error) {
    console.error(`Error fetching star texture at position ${starPosition}:`, error);
    throw error;
  }
}

