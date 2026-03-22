/**
 * Country / State / City cascading location data.
 *
 * This is a curated subset of the most commonly-used countries, states, and
 * cities for billing address forms.  It intentionally ships as a static JS
 * object so it works offline and has zero latency — no API calls required.
 *
 * To add more entries, simply extend the relevant arrays below.
 */

export interface LocationData {
  [country: string]: {
    [state: string]: string[];
  };
}

export const LOCATION_DATA: LocationData = {
  India: {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Rajahmundry", "Kakinada"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Tawang"],
    Assam: ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia"],
    Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga"],
    Chhattisgarh: ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg"],
    Goa: ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
    Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Junagadh"],
    Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Hisar", "Karnal", "Rohtak"],
    "Himachal Pradesh": ["Shimla", "Manali", "Dharamsala", "Mandi", "Solan"],
    Jharkhand: ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh"],
    Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubli", "Belgaum", "Dharwad"],
    Kerala: ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar"],
    Maharashtra: ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Navi Mumbai"],
    Manipur: ["Imphal", "Thoubal", "Bishnupur"],
    Meghalaya: ["Shillong", "Tura", "Jowai"],
    Mizoram: ["Aizawl", "Lunglei", "Champhai"],
    Nagaland: ["Kohima", "Dimapur", "Mokokchung"],
    Odisha: ["Bhubaneswar", "Cuttack", "Rourkela", "Puri", "Berhampur"],
    Punjab: ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
    Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner"],
    Sikkim: ["Gangtok", "Namchi", "Gyalshing"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", "Erode"],
    Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
    Tripura: ["Agartala", "Udaipur", "Dharmanagar"],
    "Uttar Pradesh": ["Lucknow", "Noida", "Kanpur", "Agra", "Varanasi", "Ghaziabad", "Meerut", "Prayagraj"],
    Uttarakhand: ["Dehradun", "Haridwar", "Rishikesh", "Nainital", "Haldwani"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol", "Darjeeling"],
    Delhi: ["New Delhi", "Central Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi"],
  },
  "United States": {
    Alabama: ["Birmingham", "Montgomery", "Huntsville", "Mobile"],
    Alaska: ["Anchorage", "Fairbanks", "Juneau"],
    Arizona: ["Phoenix", "Tucson", "Mesa", "Scottsdale", "Chandler"],
    Arkansas: ["Little Rock", "Fort Smith", "Fayetteville"],
    California: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Oakland", "Fresno"],
    Colorado: ["Denver", "Colorado Springs", "Aurora", "Boulder"],
    Connecticut: ["Hartford", "New Haven", "Stamford", "Bridgeport"],
    Delaware: ["Wilmington", "Dover", "Newark"],
    Florida: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"],
    Georgia: ["Atlanta", "Savannah", "Augusta", "Columbus"],
    Hawaii: ["Honolulu", "Hilo", "Kailua"],
    Idaho: ["Boise", "Nampa", "Meridian"],
    Illinois: ["Chicago", "Springfield", "Aurora", "Naperville"],
    Indiana: ["Indianapolis", "Fort Wayne", "Evansville"],
    Iowa: ["Des Moines", "Cedar Rapids", "Davenport"],
    Kansas: ["Wichita", "Overland Park", "Kansas City", "Topeka"],
    Kentucky: ["Louisville", "Lexington", "Bowling Green"],
    Louisiana: ["New Orleans", "Baton Rouge", "Shreveport"],
    Maine: ["Portland", "Lewiston", "Bangor"],
    Maryland: ["Baltimore", "Annapolis", "Frederick", "Rockville"],
    Massachusetts: ["Boston", "Cambridge", "Worcester", "Springfield"],
    Michigan: ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"],
    Minnesota: ["Minneapolis", "Saint Paul", "Rochester", "Duluth"],
    Mississippi: ["Jackson", "Gulfport", "Biloxi"],
    Missouri: ["Kansas City", "Saint Louis", "Springfield"],
    Montana: ["Billings", "Missoula", "Great Falls"],
    Nebraska: ["Omaha", "Lincoln", "Bellevue"],
    Nevada: ["Las Vegas", "Reno", "Henderson"],
    "New Hampshire": ["Manchester", "Nashua", "Concord"],
    "New Jersey": ["Newark", "Jersey City", "Trenton", "Princeton"],
    "New Mexico": ["Albuquerque", "Santa Fe", "Las Cruces"],
    "New York": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"],
    "North Carolina": ["Charlotte", "Raleigh", "Durham", "Greensboro"],
    "North Dakota": ["Fargo", "Bismarck", "Grand Forks"],
    Ohio: ["Columbus", "Cleveland", "Cincinnati", "Dayton"],
    Oklahoma: ["Oklahoma City", "Tulsa", "Norman"],
    Oregon: ["Portland", "Salem", "Eugene", "Bend"],
    Pennsylvania: ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown"],
    "Rhode Island": ["Providence", "Warwick", "Cranston"],
    "South Carolina": ["Charleston", "Columbia", "Greenville"],
    "South Dakota": ["Sioux Falls", "Rapid City", "Aberdeen"],
    Tennessee: ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
    Texas: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"],
    Utah: ["Salt Lake City", "Provo", "Ogden", "Park City"],
    Vermont: ["Burlington", "Montpelier", "Rutland"],
    Virginia: ["Virginia Beach", "Richmond", "Norfolk", "Arlington"],
    Washington: ["Seattle", "Tacoma", "Spokane", "Olympia"],
    "West Virginia": ["Charleston", "Huntington", "Morgantown"],
    Wisconsin: ["Milwaukee", "Madison", "Green Bay"],
    Wyoming: ["Cheyenne", "Casper", "Laramie"],
  },
  "United Kingdom": {
    England: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Bristol", "Sheffield", "Newcastle", "Oxford", "Cambridge"],
    Scotland: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness"],
    Wales: ["Cardiff", "Swansea", "Newport", "Bangor"],
    "Northern Ireland": ["Belfast", "Londonderry", "Lisburn", "Newry"],
  },
  Canada: {
    Ontario: ["Toronto", "Ottawa", "Mississauga", "Hamilton", "Brampton"],
    Quebec: ["Montreal", "Quebec City", "Laval", "Gatineau"],
    "British Columbia": ["Vancouver", "Victoria", "Surrey", "Burnaby"],
    Alberta: ["Calgary", "Edmonton", "Red Deer", "Lethbridge"],
    Manitoba: ["Winnipeg", "Brandon", "Steinbach"],
    Saskatchewan: ["Saskatoon", "Regina", "Prince Albert"],
    "Nova Scotia": ["Halifax", "Sydney", "Dartmouth"],
    "New Brunswick": ["Fredericton", "Moncton", "Saint John"],
    Newfoundland: ["St. John's", "Mount Pearl", "Corner Brook"],
    "Prince Edward Island": ["Charlottetown", "Summerside"],
  },
  Australia: {
    "New South Wales": ["Sydney", "Newcastle", "Wollongong"],
    Victoria: ["Melbourne", "Geelong", "Ballarat"],
    Queensland: ["Brisbane", "Gold Coast", "Cairns", "Townsville"],
    "Western Australia": ["Perth", "Fremantle", "Bunbury"],
    "South Australia": ["Adelaide", "Mount Gambier"],
    Tasmania: ["Hobart", "Launceston"],
    "Northern Territory": ["Darwin", "Alice Springs"],
    "Australian Capital Territory": ["Canberra"],
  },
  Germany: {
    Bavaria: ["Munich", "Nuremberg", "Augsburg"],
    Berlin: ["Berlin"],
    Hamburg: ["Hamburg"],
    Hesse: ["Frankfurt", "Wiesbaden", "Darmstadt"],
    "North Rhine-Westphalia": ["Cologne", "Dusseldorf", "Dortmund", "Essen", "Bonn"],
    "Baden-Wurttemberg": ["Stuttgart", "Karlsruhe", "Mannheim", "Freiburg"],
    "Lower Saxony": ["Hanover", "Brunswick", "Oldenburg"],
    Saxony: ["Dresden", "Leipzig", "Chemnitz"],
  },
  Singapore: {
    Central: ["Singapore"],
  },
  "United Arab Emirates": {
    "Abu Dhabi": ["Abu Dhabi", "Al Ain"],
    Dubai: ["Dubai"],
    Sharjah: ["Sharjah"],
    Ajman: ["Ajman"],
  },
  Japan: {
    Tokyo: ["Tokyo", "Shinjuku", "Shibuya"],
    Osaka: ["Osaka", "Sakai"],
    Kanagawa: ["Yokohama", "Kawasaki"],
    Aichi: ["Nagoya", "Toyota"],
    Kyoto: ["Kyoto"],
    Fukuoka: ["Fukuoka", "Kitakyushu"],
  },
};

/** Sorted list of all country names */
export function getCountries(): string[] {
  return Object.keys(LOCATION_DATA).sort();
}

/** States/provinces for a given country */
export function getStates(country: string): string[] {
  const states = LOCATION_DATA[country];
  return states ? Object.keys(states).sort() : [];
}

/** Cities for a given country + state combination */
export function getCities(country: string, state: string): string[] {
  const cities = LOCATION_DATA[country]?.[state];
  return cities ? [...cities].sort() : [];
}
