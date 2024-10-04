// Base URL of your backend API
const API_BASE_URL = 'https://your-backend-server.com/api';

// Function to register a new game and get a UUID
async function registerNewGame() {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to register new game: ${response.statusText}`);
    }

    const data = await response.json();
    const uuid = data.uuid;

    // Save UUID locally (e.g., in localStorage)
    localStorage.setItem('gameUUID', uuid);

    return uuid;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to save game data
async function saveGame(uuid, gameData) {
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
async function loadGame(uuid) {
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
async function resetGame(uuid) {
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

    // Delete UUID locally
    localStorage.removeItem('gameUUID');

    return data.confirmation; // Assuming the backend sends a confirmation message
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to get an image based on coordinates
async function getImage(coordinates) {
  try {
    const response = await fetch(`${API_BASE_URL}/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coordinates }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    return imageUrl;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Example usage (to be integrated into your main code later):




