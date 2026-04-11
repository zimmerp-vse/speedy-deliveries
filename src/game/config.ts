// All game parameters collected here for easy tuning
export const GAME_CONFIG = {
  // Round settings
  totalRounds: 10,
  tripDurationMs: 45000, // 45 seconds per trip (generous)
  
  // Speed settings
  maxSpeed: 120,
  cruiseSpeed: 60,
  launchAcceleration: 40,
  acceleration: 18,
  braking: 80,
  coastDeceleration: 4,
  idleDeceleration: 12,
  stopSpeedThreshold: 8,
  steeringSpeed: 4.5,
  
  // Road settings
  roadWidth: 2000,
  segmentLength: 200,
  drawDistance: 150,
  laneCount: 3,
  
  // Obstacle spawn chances per advanced road segment
  carSpawnRate: 0.010,
  obstacleSpawnRate: 0.005,
  pedestrianSpawnRate: 0.003,
  
  // Financial
  deliveryReward: 500,
  carCollisionCost: 300,
  obstacleCollisionCost: 200,
  pedestrianCollisionCost: 150,
  startingMoney: 1000,
  
  // Delivery distance (in segments)
  deliveryDistance: 300,
  destinationVisibleDistance: 28, // how many segments before finish the destination appears
  
  // Delivery types (extensible)
  deliveryTypes: [
    { emoji: '🏠', label: 'House', waver: '🧑', waverEmoji: '👋' },
    { emoji: '🛥️', label: 'Yacht', waver: '🧑‍✈️', waverEmoji: '👋' },
    { emoji: '🚛', label: 'Truck', waver: '👷', waverEmoji: '👋' },
    { emoji: '🏢', label: 'Office', waver: '🧑‍💼', waverEmoji: '👋' },
    { emoji: '🏪', label: 'Shop', waver: '🧑‍🍳', waverEmoji: '👋' },
  ],
  
  // Celebration
  celebrationDurationMs: 1500,
  celebrationEmojis: ['⭐', '🎉', '💰', '🎊', '✨', '🌟'],
  
  // Visual
  cameraHeight: 1000,
  cameraDepth: 0.84, // 1 / tan(fov/2)
  fogDensity: 5,
  
  // Scenes / backgrounds
  scenes: [
    { name: 'Sunset Beach', skyTop: '#ff6b35', skyBottom: '#ffd166', groundColor: '#c8b560',
      scenery: ['🌴', '🏖️', '⛱️', '🌊'],
      horizon: ['🌅', '⛵', '🏝️'],
      midground: ['🌴', '🏠', '🛖', '🌴', '🏖️'] },
    { name: 'Mountain Pass', skyTop: '#1a1a4e', skyBottom: '#e07050', groundColor: '#556b2f',
      scenery: ['🏔️', '🌲', '⛰️', '🪨'],
      horizon: ['🏔️', '⛰️', '🗻'],
      midground: ['🌲', '🌲', '🏕️', '🌲', '🌳'] },
    { name: 'City Night', skyTop: '#0a0a2e', skyBottom: '#2d1b69', groundColor: '#333333',
      scenery: ['🏢', '🏬', '🏪', '🏗️', '🚏'],
      horizon: ['🏙️', '🌃', '🏢'],
      midground: ['🏠', '🏘️', '🏗️', '🏬', '🏪', '🏢', '🏨'] },
    { name: 'Desert Highway', skyTop: '#ff8c42', skyBottom: '#ffd700', groundColor: '#daa520',
      scenery: ['🌵', '🏜️', '💀', '🦂'],
      horizon: ['🏜️', '⛰️'],
      midground: ['🌵', '🌵', '🏚️', '🌵', '🦎'] },
    { name: 'Rainy Town', skyTop: '#4a5568', skyBottom: '#718096', groundColor: '#2d5016',
      scenery: ['🏘️', '🌳', '🏠', '🚏', '⛪'],
      horizon: ['🏘️', '⛪', '🏭'],
      midground: ['🏠', '🏡', '🌳', '🏠', '🌲', '🏘️'] },
    { name: 'Coastal Road', skyTop: '#0ea5e9', skyBottom: '#7dd3fc', groundColor: '#22c55e',
      scenery: ['🌴', '⛵', '🏝️', '🐚'],
      horizon: ['⛵', '🚢', '🏝️'],
      midground: ['🌴', '🏠', '🛖', '🌴', '🐠'] },
    { name: 'Autumn Forest', skyTop: '#92400e', skyBottom: '#f59e0b', groundColor: '#b45309',
      scenery: ['🍂', '🌳', '🍁', '🌲', '🦌'],
      horizon: ['🌄', '⛰️', '🌲'],
      midground: ['🌳', '🍂', '🌲', '🏡', '🌳', '🌲'] },
    { name: 'Snow Valley', skyTop: '#94a3b8', skyBottom: '#e2e8f0', groundColor: '#f1f5f9',
      scenery: ['🎿', '⛷️', '🏔️', '🌨️', '⛄'],
      horizon: ['🏔️', '🗻', '❄️'],
      midground: ['⛄', '🌲', '🏠', '🌲', '⛄', '🏔️'] },
    { name: 'Tropical Island', skyTop: '#06b6d4', skyBottom: '#a78bfa', groundColor: '#15803d',
      scenery: ['🌴', '🌺', '🦜', '🍍'],
      horizon: ['🏝️', '⛵', '🌅'],
      midground: ['🌴', '🌺', '🛖', '🌴', '🦜'] },
    { name: 'Volcano Road', skyTop: '#7f1d1d', skyBottom: '#f97316', groundColor: '#44403c',
      scenery: ['🌋', '🪨', '🔥', '💨'],
      horizon: ['🌋', '🗻', '🔥'],
      midground: ['🪨', '🌋', '🪨', '💨', '🪨'] },
  ],
  
  // Fun delivery rewards (shown on successful delivery)
  deliveryRewards: [
    '💋 You got a kiss from the grateful customer!',
    '🎂 Free cake! The bakery says thanks!',
    '🌟 5-star rating! You\'re a delivery legend!',
    '🎸 The customer played you a guitar solo!',
    '🐕 A puppy licked your face! Best tip ever!',
    '🍕 Free pizza for life! (this week only)',
    '🏆 Employee of the minute! Trophy unlocked!',
    '💃 The whole neighborhood did a victory dance!',
    '🎪 A mini parade in your honor!',
    '🦄 A unicorn appeared and blessed your car!',
  ],
  
  // Fun accident passenger reactions
  accidentReactions: [
    '😤 "I TOLD you to slow down!"',
    '🤬 "My coffee went EVERYWHERE!"',
    '😱 "I\'m calling your manager!"',
    '🤮 "I think I\'m gonna be sick..."',
    '😭 "My phone flew out the window!"',
    '💢 "That\'s coming out of YOUR paycheck!"',
    '🙈 "I can\'t watch anymore!"',
    '😡 "I\'m leaving you a 1-star review!"',
    '🫣 "Are you even licensed?!"',
    '😤 "My grandma drives better than this!"',
  ],
  
  // Obstacle types
  obstacles: {
    cars: ['🚗', '🚙', '🚕', '🚌', '🏎️'],
    roadObstacles: ['🌳', '🐄', '🐑', '🪨', '🛢️'],
    pedestrians: ['🧑‍🎓', '👨‍🎓', '👩‍🎓', '🚶', '🧑‍🦯'],
  },
  
  // Splash/fun effects for pedestrian "accidents"
  pedestrianEffects: [
    '💦 SPLASH! Student got soaked!',
    '💦 Puddle combo! Double splash!',
    '🌊 Tidal wave from the gutter!',
    '💧 Whoops! Mud shower activated!',
    '💦 Sprinkler mode engaged!',
  ],
};

export type AccidentType = 'car' | 'obstacle' | 'pedestrian';

export interface RoundResult {
  round: number;
  success: boolean;
  accidentType?: AccidentType;
  moneyEarned: number;
  moneyLost: number;
  scene: string;
  timeMs: number;
}

export interface GameData {
  rounds: RoundResult[];
  totalMoney: number;
  totalDeliveries: number;
  totalAccidents: { car: number; obstacle: number; pedestrian: number };
}
