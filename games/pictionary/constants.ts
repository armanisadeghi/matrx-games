export const WORD_LISTS = {
  easy: [
    "cat", "dog", "house", "tree", "car", "sun", "moon", "star", "fish", "bird",
    "hat", "shoe", "ball", "book", "chair", "table", "door", "window", "flower",
    "apple", "banana", "cake", "pizza", "boat", "train", "plane", "bike",
    "clock", "phone", "lamp", "guitar", "drum", "heart", "cloud", "rain",
    "snow", "fire", "water", "mountain", "beach", "island", "bridge", "castle",
    "robot", "ghost", "witch", "dragon", "crown", "sword", "shield",
  ],
  medium: [
    "astronaut", "telescope", "dinosaur", "volcano", "tornado", "earthquake",
    "submarine", "helicopter", "parachute", "trampoline", "skateboard",
    "snowboard", "surfboard", "lighthouse", "waterfall", "rainbow", "butterfly",
    "caterpillar", "scorpion", "octopus", "jellyfish", "seahorse", "penguin",
    "flamingo", "peacock", "kangaroo", "giraffe", "elephant", "rhinoceros",
    "campfire", "fireworks", "carnival", "rollercoaster", "magician",
    "treasure", "pirate", "mermaid", "unicorn", "werewolf", "vampire",
    "spaghetti", "hamburger", "milkshake", "pineapple", "broccoli",
    "mushroom", "sandwich", "popcorn", "chocolate", "lollipop",
  ],
  hard: [
    "photosynthesis", "democracy", "evolution", "constellation", "metamorphosis",
    "procrastination", "nostalgia", "claustrophobia", "hallucination",
    "superstition", "civilization", "architecture", "philosophy", "mythology",
    "cryptocurrency", "biodiversity", "electromagnetic", "archaeological",
    "choreography", "ventriloquist", "hieroglyphics", "pandemonium",
    "kaleidoscope", "seismograph", "thermometer", "stethoscope",
    "encyclopedia", "bibliography", "autobiography", "onomatopoeia",
  ],
} as const;

export const DEFAULT_SETTINGS = {
  roundsPerTeam: 3,
  timerDuration: 60000, // 60 seconds
  wordDifficulty: "medium" as keyof typeof WORD_LISTS,
};

export type PictionaryDifficulty = keyof typeof WORD_LISTS;
