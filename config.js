const API_BASE_URL = 'https://caiman-gentle-sunbird.ngrok-free.app';

const numberOfDimensions = 5;

const totalNumberOfStars = 6000;
const starSize = 500;
const starDistanceMin = 1000;
const starDistanceMax = 1000000;

const totalNumbersOfAsteroids = 5000;
const asteroidSize = 1;
const asteroidResetDistance = 5000;

const rotationSpeed = 0.02;
const maxSpeed = 10000;
const normalAcceleration = 1;
const superAcceleration = 500;
const superDeceleration = 500;
const warpAcceleration = maxSpeed / 3;
const warpDeceleration = maxSpeed / 3;

const sliceThickness = 150000; // Determines how far stars in unmapped dimensions remain visible from the 3D slice.
const perspectiveFactor = 15000000; // Controls the rate of size shrinkage for stars based on distance in unmapped dimensions.
const dimensionShiftDuration = 3 // Seconds

const textureDistance = 50000; // Controls at what distance textures get rendered

const dimensionColors = [
  '#FF0000', // Dimension 1 - Red
  '#00FF00', // Dimension 2 - Green
  '#0000FF', // Dimension 3 - Blue
  '#FFD700', // Dimension 4 - Dark Yellow
  '#FF00FF', // Dimension 5 - Magenta
  '#00FFFF', // Dimension 6 - Cyan
  '#800000', // Dimension 7 - Maroon
  '#008000', // Dimension 8 - Dark Green
  '#000080', // Dimension 9 - Navy Blue
  '#808000'  // Dimension 10 - Olive
];