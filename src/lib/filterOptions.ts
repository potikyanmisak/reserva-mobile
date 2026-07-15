// Single source of truth for restaurant filter/tag categories.
// Used by both CustomerDashboard (filtering) and OwnerDashboard (tagging).
// IMPORTANT: because filtering uses exact string matching against data
// stored on the restaurant record, these values must never diverge between
// where they're written (owner) and where they're filtered (customer).
// Add/rename values here only — never redefine these lists elsewhere.

export const CUISINES = [
  "Italian",
  "Bistro",
  "Armenian",
  "Asian",
  "Sushi",
  "Steakhouse",
  "Fast Food",
  "Cafe",
  "Fine Dining",
  "Japanese",
  "Mexican",
  "French",
  "Chinese",
];

export const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"];

export const RATINGS = [4.5, 4.0, 3.5];

export const EXPERIENCE_GROUPS: Record<string, string[]> = {
  "Food & Drink": [
    "Buffet",
    "Fast Casual",
    "Food Hall",
    "Street Food Spot",
    "Bakery",
    "Dessert Bar",
    "Brunch Spot",
  ],
  "Social & Nightlife": [
    "Hookah Lounge",
    "Bar",
    "Pub",
    "Cocktail Bar",
    "Sports Bar",
    "Nightclub",
    "Wine Bar",
    "Live Music",
    "DJ Night",
    "Karaoke Bar",
  ],
  Atmosphere: [
    "Rooftop",
    "Waterfront View",
    "Garden",
    "Cozy & Intimate",
    "Luxury",
    "Industrial",
    "Traditional Theme",
  ],
  Occasion: [
    "Romantic",
    "Family Friendly",
    "Business Lunch",
    "Date Night",
    "Study-Friendly",
    "Tourist Friendly",
  ],
};

export const AMENITIES = [
  "Outdoor Seating",
  "Indoor Seating Only",
  "Parking",
  "Valet Parking",
  "Wi-Fi",
  "Pet Friendly",
  "Wheelchair Access",
  "Private Room",
  "Reservations Required",
  "Walk-ins Only",
  "Smoking Area",
  "Hookah",
  "Live TV",
  "Charging Ports",
  "Kids Area",
  "Vegan Options",
  "Halal",
  "Late Night (after 11 PM)",
];

export const MOODS = [
  "Chill Hangout",
  "Romantic Date",
  "Birthday",
  "Business",
  "Quick Bite",
  "Luxury",
  "Family",
  "Solo",
  "Tourist Exploration",
  "Late Night",
];
