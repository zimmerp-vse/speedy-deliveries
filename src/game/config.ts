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
  drawDistance: 90,
  laneCount: 3,
  
  // Obstacle spawn chances per advanced road segment
  carSpawnRate: 0.030,
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
  destinationVisibleDistance: 40, // how many segments before finish the destination appears
  safeFinish: false, // INIT difficulty.safeFinish: shorter finish zone without hazards
  
  // Delivery types (extensible)
  deliveryTypes: [
    { emoji: '🏠', label: 'House', waver: '🧑', waverEmoji: '👋' },
    { emoji: '🛥️', label: 'Yacht', waver: '🧑‍✈️', waverEmoji: '👋' },
    { emoji: '🚛', label: 'Truck', waver: '👷', waverEmoji: '👋' },
    { emoji: '🏢', label: 'Office', waver: '🧑‍💼', waverEmoji: '👋' },
    { emoji: '🏪', label: 'Shop', waver: '🧑‍🍳', waverEmoji: '👋' },
  ],
  
  // Celebration
  celebrationDurationMs: 3200,
  celebrationEmojis: ['⭐', '🎉', '💰', '🎊', '✨', '🌟'],
  
  // Visual
  cameraHeight: 1000,
  cameraDepth: 0.84, // 1 / tan(fov/2)
  fogDensity: 5,
  
  // Scenes / backgrounds
  scenes: [
    { name: 'Sunset Beach', skyTop: '#ff6b35', skyBottom: '#ffd166',
      groundLeft: '#d4a54a', groundRight: '#2196c8',
      groundLeftAlt: '#c89840', groundRightAlt: '#1a82b5',
      leftBands: [['#c8b060','#b8a050',1.5], ['#d4a54a','#c89840',2.5], ['#c89030','#b88020',4], ['#b87a20','#a86a10',7]],
      rightBands: [['#60b8c0','#50a8b0',1.5], ['#2196c8','#1a82b5',2.5], ['#1878a8','#106898',4], ['#0e5888','#084878',7]],
      scenery: ['🌴', '🏖️', '⛱️', '🌊'],
      leftScenery: ['🌴', '🏠', '⛱️', '🏖️', '🌴'],
      rightScenery: ['🌊', '🏄', '⛵', '🌊', '🐚'],
      horizon: ['🌅', '⛵', '🏝️'],
      midground: ['🌴', '🏠', '🛖', '🌴', '🏖️'] },
    { name: 'Mountain Pass', skyTop: '#1a1a4e', skyBottom: '#e07050',
      groundLeft: '#4a6b28', groundRight: '#3d5e20',
      groundLeftAlt: '#3f5d22', groundRightAlt: '#34501a',
      leftBands: [['#4a6b28','#3f5d22',1.5], ['#3d5e20','#34501a',2.5], ['#5a5040','#4a4030',4], ['#6a6050','#5a5040',7]],
      rightBands: [['#3d5e20','#34501a',1.5], ['#4a6b28','#3f5d22',2.5], ['#5a5040','#4a4030',4], ['#6a6050','#5a5040',7]],
      scenery: ['🏔️', '🌲', '⛰️', '🪨'],
      leftScenery: ['🌲', '🌲', '🏕️', '🌳', '🪨'],
      rightScenery: ['🌲', '⛰️', '🌲', '🌲', '🏔️'],
      horizon: ['🏔️', '⛰️', '🗻'],
      midground: ['🌲', '🌲', '🏕️', '🌲', '🌳'] },
    { name: 'City Night', skyTop: '#0a0a2e', skyBottom: '#2d1b69',
      groundLeft: '#2a2a2a', groundRight: '#2a2a2a',
      groundLeftAlt: '#333333', groundRightAlt: '#333333',
      leftBands: [['#3a3a3a','#333333',1.5], ['#2a2a2a','#252525',2.5], ['#222222','#1e1e1e',4], ['#1a1a1a','#151515',7]],
      rightBands: [['#3a3a3a','#333333',1.5], ['#2a2a2a','#252525',2.5], ['#222222','#1e1e1e',4], ['#1a1a1a','#151515',7]],
      scenery: ['🏢', '🏬', '🏪', '🏗️', '🚏'],
      leftScenery: ['🏢', '🏬', '🏠', '🏗️', '🏪'],
      rightScenery: ['🏨', '🏢', '🏘️', '🏬', '🚏'],
      horizon: ['🏙️', '🌃', '🏢'],
      midground: ['🏠', '🏘️', '🏗️', '🏬', '🏪', '🏢', '🏨'] },
    { name: 'Desert Highway', skyTop: '#ff8c42', skyBottom: '#ffd700',
      groundLeft: '#d4a840', groundRight: '#c89830',
      groundLeftAlt: '#c89830', groundRightAlt: '#b88820',
      leftBands: [['#d4a840','#c89830',1.5], ['#c89020','#b88010',2.5], ['#b07808','#a06808',4], ['#906000','#805000',7]],
      rightBands: [['#c89830','#b88820',1.5], ['#c89020','#b88010',2.5], ['#b07808','#a06808',4], ['#906000','#805000',7]],
      scenery: ['🌵', '🏜️', '💀', '🦂'],
      leftScenery: ['🌵', '🌵', '🏚️', '🌵', '🪨'],
      rightScenery: ['🌵', '🦎', '💀', '🌵', '🏜️'],
      horizon: ['🏜️', '⛰️'],
      midground: ['🌵', '🌵', '🏚️', '🌵', '🦎'] },
    { name: 'Rainy Town', skyTop: '#4a5568', skyBottom: '#718096',
      groundLeft: '#2d5016', groundRight: '#2d5016',
      groundLeftAlt: '#24440f', groundRightAlt: '#24440f',
      leftBands: [['#2d5016','#24440f',1.5], ['#3a6020','#2d5016',2.5], ['#2a4510','#224008',4], ['#1e3808','#183005',7]],
      rightBands: [['#2d5016','#24440f',1.5], ['#3a6020','#2d5016',2.5], ['#2a4510','#224008',4], ['#1e3808','#183005',7]],
      scenery: ['🏘️', '🌳', '🏠', '🚏', '⛪'],
      leftScenery: ['🏠', '🏡', '🌳', '🏘️', '⛪'],
      rightScenery: ['🏠', '🌳', '🏡', '🚏', '🏘️'],
      horizon: ['🏘️', '⛪', '🏭'],
      midground: ['🏠', '🏡', '🌳', '🏠', '🌲', '🏘️'] },
    { name: 'Coastal Road', skyTop: '#0ea5e9', skyBottom: '#7dd3fc',
      groundLeft: '#22a55e', groundRight: '#1a8ec8',
      groundLeftAlt: '#1e944f', groundRightAlt: '#1580b5',
      leftBands: [['#22a55e','#1e944f',1.5], ['#2db86a','#28a860',2.5], ['#38c478','#30b870',4], ['#40d080','#38c478',7]],
      rightBands: [['#d4c090','#c8b080',1.5], ['#1a8ec8','#1580b5',2.5], ['#1070a0','#0c6090',4], ['#085080','#044070',7]],
      scenery: ['🌴', '⛵', '🏝️', '🐚'],
      leftScenery: ['🌴', '🏠', '🌴', '🌺', '🛖'],
      rightScenery: ['🌊', '⛵', '🏄', '🌊', '🐚'],
      horizon: ['⛵', '🚢', '🏝️'],
      midground: ['🌴', '🏠', '🛖', '🌴', '🐠'] },
    { name: 'Autumn Forest', skyTop: '#92400e', skyBottom: '#f59e0b',
      groundLeft: '#a04a10', groundRight: '#8b4008',
      groundLeftAlt: '#904008', groundRightAlt: '#7d3806',
      leftBands: [['#a04a10','#904008',1.5], ['#8b4008','#7d3806',2.5], ['#7a3506','#6a2a04',4], ['#5a2004','#4a1802',7]],
      rightBands: [['#8b4008','#7d3806',1.5], ['#a04a10','#904008',2.5], ['#7a3506','#6a2a04',4], ['#5a2004','#4a1802',7]],
      scenery: ['🍂', '🌳', '🍁', '🌲', '🦌'],
      leftScenery: ['🌳', '🍂', '🌲', '🏡', '🍁'],
      rightScenery: ['🌲', '🍁', '🌳', '🦌', '🌲'],
      horizon: ['🌄', '⛰️', '🌲'],
      midground: ['🌳', '🍂', '🌲', '🏡', '🌳', '🌲'] },
    { name: 'Snow Valley', skyTop: '#94a3b8', skyBottom: '#e2e8f0',
      groundLeft: '#e8ecf0', groundRight: '#dce0e4',
      groundLeftAlt: '#d8dce0', groundRightAlt: '#ccd0d4',
      leftBands: [['#e8ecf0','#d8dce0',1.5], ['#d0d8e0','#c8d0d8',2.5], ['#c0c8d0','#b8c0c8',4], ['#b0b8c0','#a8b0b8',7]],
      rightBands: [['#dce0e4','#ccd0d4',1.5], ['#d0d8e0','#c8d0d8',2.5], ['#c0c8d0','#b8c0c8',4], ['#b0b8c0','#a8b0b8',7]],
      scenery: ['🎿', '⛷️', '🏔️', '🌨️', '⛄'],
      leftScenery: ['🌲', '⛄', '🏠', '🌲', '🏔️'],
      rightScenery: ['⛄', '🌲', '🎿', '🌲', '⛷️'],
      horizon: ['🏔️', '🗻', '❄️'],
      midground: ['⛄', '🌲', '🏠', '🌲', '⛄', '🏔️'] },
    { name: 'Tropical Island', skyTop: '#06b6d4', skyBottom: '#a78bfa',
      groundLeft: '#15803d', groundRight: '#1a90c0',
      groundLeftAlt: '#127035', groundRightAlt: '#1580aa',
      leftBands: [['#15803d','#127035',1.5], ['#1a9048','#15803d',2.5], ['#20a050','#1a9048',4], ['#28b060','#20a050',7]],
      rightBands: [['#d4c890','#c8b880',1.5], ['#1a90c0','#1580aa',2.5], ['#1070a0','#0c6090',4], ['#085080','#044070',7]],
      scenery: ['🌴', '🌺', '🦜', '🍍'],
      leftScenery: ['🌴', '🌺', '🛖', '🌴', '🍍'],
      rightScenery: ['🌊', '🏄', '🐬', '🌊', '⛵'],
      horizon: ['🏝️', '⛵', '🌅'],
      midground: ['🌴', '🌺', '🛖', '🌴', '🦜'] },
    { name: 'Volcano Road', skyTop: '#7f1d1d', skyBottom: '#f97316',
      groundLeft: '#3d3530', groundRight: '#352d28',
      groundLeftAlt: '#443c37', groundRightAlt: '#3d3530',
      leftBands: [['#3d3530','#443c37',1.5], ['#4a4038','#3d3530',2.5], ['#352d28','#2d2520',4], ['#251d18','#1d1510',7]],
      rightBands: [['#352d28','#3d3530',1.5], ['#4a4038','#3d3530',2.5], ['#352d28','#2d2520',4], ['#251d18','#1d1510',7]],
      scenery: ['🌋', '🪨', '🔥', '💨'],
      leftScenery: ['🪨', '🌋', '🪨', '💨', '🔥'],
      rightScenery: ['🪨', '💨', '🪨', '🌋', '🪨'],
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
    cars: ['🚗', '🚙', '🚕', '🏎️', '🚓', '🚚', '🚛', '🚜', '🚐'],
    roadObstacles: ['🚧', '🛢️', '🚏', '⚠️', '🪧', '🧱'],
    pedestrians: ['👷', '👷‍♂️', '👷‍♀️', '🚶', '🧑‍🔧'],
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
