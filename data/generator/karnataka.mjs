// Karnataka reference data for the NETRA synthetic crime dataset.
// Bilingual (English + Kannada) name pools, districts with approximate geo,
// crime taxonomy with IPC/BNS sections and modus-operandi tags.

// Districts: [name, lat, lng, urbanization_index(0-1), literacy_rate(%), unemployment_proxy(0-1)]
export const DISTRICTS = [
  ['Bengaluru Urban', 12.9716, 77.5946, 0.95, 88, 0.18],
  ['Bengaluru Rural', 13.2846, 77.6200, 0.55, 80, 0.22],
  ['Mysuru', 12.2958, 76.6394, 0.78, 85, 0.20],
  ['Mandya', 12.5223, 76.8954, 0.45, 78, 0.26],
  ['Hassan', 13.0072, 76.0962, 0.42, 79, 0.24],
  ['Tumakuru', 13.3379, 77.1173, 0.50, 80, 0.25],
  ['Kolar', 13.1357, 78.1296, 0.48, 77, 0.27],
  ['Davanagere', 14.4644, 75.9218, 0.60, 80, 0.23],
  ['Shivamogga', 13.9299, 75.5681, 0.55, 83, 0.22],
  ['Ballari', 15.1394, 76.9214, 0.58, 74, 0.28],
  ['Vijayapura', 16.8302, 75.7100, 0.46, 72, 0.30],
  ['Kalaburagi', 17.3297, 76.8343, 0.52, 70, 0.31],
  ['Belagavi', 15.8497, 74.4977, 0.57, 79, 0.24],
  ['Dharwad', 15.4589, 75.0078, 0.70, 82, 0.21],
  ['Hubballi', 15.3647, 75.1240, 0.75, 83, 0.20],
  ['Udupi', 13.3409, 74.7421, 0.62, 92, 0.16],
  ['Dakshina Kannada', 12.9141, 74.8560, 0.80, 91, 0.17],
  ['Uttara Kannada', 14.8183, 74.1297, 0.40, 84, 0.23],
  ['Chitradurga', 14.2251, 76.3980, 0.44, 76, 0.27],
  ['Raichur', 16.2076, 77.3463, 0.45, 68, 0.32],
  ['Bidar', 17.9106, 77.5199, 0.47, 71, 0.30],
  ['Chikkamagaluru', 13.3161, 75.7720, 0.41, 85, 0.21],
  ['Kodagu', 12.4218, 75.7400, 0.38, 86, 0.19],
  ['Chamarajanagar', 11.9261, 76.9437, 0.39, 73, 0.28],
];

// Police-station name suffixes used to synthesise station names per district.
export const STATION_AREAS = [
  'City', 'Town', 'Rural', 'North', 'South', 'East', 'West', 'Market',
  'Cantonment', 'Industrial Area', 'Lake', 'Old Town', 'New Extension', 'Highway',
];

// Aligned EN/KN name pools (index i: English[i] ↔ Kannada[i]).
export const MALE_FIRST = [
  ['Ramesh', 'ರಮೇಶ್'], ['Suresh', 'ಸುರೇಶ್'], ['Mahesh', 'ಮಹೇಶ್'], ['Manjunatha', 'ಮಂಜುನಾಥ'],
  ['Praveen', 'ಪ್ರವೀಣ್'], ['Kiran', 'ಕಿರಣ್'], ['Nagaraj', 'ನಾಗರಾಜ್'], ['Shivakumar', 'ಶಿವಕುಮಾರ್'],
  ['Basavaraj', 'ಬಸವರಾಜ್'], ['Ravi', 'ರವಿ'], ['Santosh', 'ಸಂತೋಷ್'], ['Naveen', 'ನವೀನ್'],
  ['Arun', 'ಅರುಣ್'], ['Girish', 'ಗಿರೀಶ್'], ['Lokesh', 'ಲೋಕೇಶ್'], ['Prakash', 'ಪ್ರಕಾಶ್'],
  ['Harish', 'ಹರೀಶ್'], ['Vinod', 'ವಿನೋದ್'], ['Gopala', 'ಗೋಪಾಲ'], ['Veeresh', 'ವೀರೇಶ್'],
];

export const FEMALE_FIRST = [
  ['Lakshmi', 'ಲಕ್ಷ್ಮಿ'], ['Geetha', 'ಗೀತಾ'], ['Pooja', 'ಪೂಜಾ'], ['Divya', 'ದಿವ್ಯಾ'],
  ['Ananya', 'ಅನನ್ಯಾ'], ['Bhavya', 'ಭವ್ಯಾ'], ['Deepa', 'ದೀಪಾ'], ['Kavya', 'ಕಾವ್ಯಾ'],
  ['Roopa', 'ರೂಪಾ'], ['Sushma', 'ಸುಷ್ಮಾ'], ['Vidya', 'ವಿದ್ಯಾ'], ['Manjula', 'ಮಂಜುಳಾ'],
];

export const SURNAMES = [
  ['Gowda', 'ಗೌಡ'], ['Reddy', 'ರೆಡ್ಡಿ'], ['Patil', 'ಪಾಟೀಲ್'], ['Naik', 'ನಾಯ್ಕ್'],
  ['Shetty', 'ಶೆಟ್ಟಿ'], ['Rao', 'ರಾವ್'], ['Hegde', 'ಹೆಗಡೆ'], ['Kulkarni', 'ಕುಲಕರ್ಣಿ'],
  ['Desai', 'ದೇಸಾಯಿ'], ['Murthy', 'ಮೂರ್ತಿ'], ['Bhat', 'ಭಟ್'], ['Kamath', 'ಕಾಮತ್'],
  ['Acharya', 'ಆಚಾರ್ಯ'], ['Prabhu', 'ಪ್ರಭು'], ['Joshi', 'ಜೋಶಿ'], ['Shastry', 'ಶಾಸ್ತ್ರಿ'],
];

export const OCCUPATIONS = [
  'Daily wage labourer', 'Auto driver', 'Shopkeeper', 'Unemployed', 'Farmer',
  'Mechanic', 'Construction worker', 'Private security', 'Street vendor',
  'Delivery agent', 'Factory worker', 'Driver', 'Electrician', 'Painter',
];

export const SOCIO_BANDS = ['Low income', 'Lower-middle income', 'Middle income', 'Upper-middle income'];

// Crime taxonomy: type -> { sections (IPC/BNS), mo tags, base severity (1-5), weapon? }
export const CRIME_TYPES = {
  'Theft': { sections: ['IPC 379', 'BNS 303'], mo: ['pickpocket', 'unattended', 'market', 'crowded-bus'], severity: 2 },
  'Burglary': { sections: ['IPC 457', 'IPC 380', 'BNS 305'], mo: ['night', 'rear-entry', 'cut-grill', 'unoccupied-house'], severity: 3 },
  'Chain Snatching': { sections: ['IPC 356', 'IPC 379', 'BNS 304'], mo: ['two-wheeler', 'pillion-rider', 'evening', 'gold-chain', 'main-road'], severity: 3 },
  'Robbery': { sections: ['IPC 392', 'IPC 394', 'BNS 309'], mo: ['weapon-threat', 'two-wheeler', 'isolated-road', 'night'], severity: 4 },
  'Motor Vehicle Theft': { sections: ['IPC 379', 'BNS 303'], mo: ['master-key', 'two-wheeler', 'parking-lot', 'no-lock'], severity: 3 },
  'Assault': { sections: ['IPC 323', 'IPC 324', 'BNS 115'], mo: ['public-place', 'altercation', 'group', 'sharp-weapon'], severity: 3 },
  'Cheating': { sections: ['IPC 420', 'BNS 318'], mo: ['fake-promise', 'investment-scam', 'forged-document'], severity: 3 },
  'Cyber Fraud': { sections: ['IT Act 66C', 'IT Act 66D', 'IPC 420'], mo: ['otp-fraud', 'fake-kyc', 'upi', 'phishing-call', 'fake-customer-care'], severity: 3 },
  'Extortion': { sections: ['IPC 384', 'BNS 308'], mo: ['threat-call', 'gang', 'protection-money', 'businessman-target'], severity: 4 },
  'Kidnapping': { sections: ['IPC 363', 'IPC 365', 'BNS 137'], mo: ['ransom', 'vehicle', 'lure', 'minor-target'], severity: 5 },
  'Murder': { sections: ['IPC 302', 'BNS 103'], mo: ['sharp-weapon', 'personal-enmity', 'premeditated', 'night'], severity: 5 },
  'Attempt to Murder': { sections: ['IPC 307', 'BNS 109'], mo: ['sharp-weapon', 'enmity', 'ambush'], severity: 5 },
  'Rioting': { sections: ['IPC 147', 'BNS 191'], mo: ['group', 'public-place', 'communal', 'property-damage'], severity: 4 },
  'Dowry Harassment': { sections: ['IPC 498A', 'BNS 85'], mo: ['domestic', 'in-laws', 'repeated-harassment'], severity: 4 },
  'NDPS / Drugs': { sections: ['NDPS Act 20', 'NDPS Act 22'], mo: ['peddling', 'ganja', 'mdma', 'party-supply'], severity: 4 },
  'House Trespass': { sections: ['IPC 448', 'BNS 329'], mo: ['unauthorised-entry', 'day', 'reconnaissance'], severity: 2 },
  'Counterfeiting': { sections: ['IPC 489A', 'BNS 178'], mo: ['fake-currency', 'circulation', 'market'], severity: 4 },
  'Money Laundering': { sections: ['PMLA 3', 'IPC 420'], mo: ['layering', 'shell-account', 'mule', 'hawala'], severity: 4 },
};

export const FIR_STATUSES = ['registered', 'under_investigation', 'chargesheeted', 'closed'];

export const BANKS = ['SBI', 'Canara Bank', 'Union Bank', 'KGB', 'Axis Bank', 'HDFC Bank', 'ICICI Bank'];

// Kannada narrative templates per crime type (filled with name/place/amount).
export const KN_NARRATIVES = {
  'Chain Snatching': 'ದೂರುದಾರರು ಸಂಜೆ {place} ಮುಖ್ಯರಸ್ತೆಯಲ್ಲಿ ನಡೆದುಕೊಂಡು ಹೋಗುತ್ತಿದ್ದಾಗ, ದ್ವಿಚಕ್ರ ವಾಹನದಲ್ಲಿ ಬಂದ ಇಬ್ಬರು ಆರೋಪಿಗಳು ಚಿನ್ನದ ಸರವನ್ನು ಕಿತ್ತುಕೊಂಡು ಪರಾರಿಯಾದರು.',
  'Burglary': 'ರಾತ್ರಿ ವೇಳೆ ಮನೆಯ ಹಿಂಭಾಗದ ಕಿಟಕಿಯ ಕಬ್ಬಿಣದ ಸರಳುಗಳನ್ನು ಕತ್ತರಿಸಿ ಒಳ ಪ್ರವೇಶಿಸಿದ ಕಳ್ಳರು ಚಿನ್ನಾಭರಣ ಮತ್ತು ನಗದು ಹಣವನ್ನು ಕದ್ದಿದ್ದಾರೆ.',
  'Cyber Fraud': 'ಅಪರಿಚಿತ ವ್ಯಕ್ತಿ ಬ್ಯಾಂಕ್ ಸಿಬ್ಬಂದಿ ಎಂದು ಹೇಳಿಕೊಂಡು ಕರೆ ಮಾಡಿ, ಕೆವೈಸಿ ಅಪ್‌ಡೇಟ್ ನೆಪದಲ್ಲಿ ಒಟಿಪಿ ಪಡೆದು ಖಾತೆಯಿಂದ ಹಣ ವರ್ಗಾವಣೆ ಮಾಡಿಕೊಂಡಿದ್ದಾನೆ.',
  'Motor Vehicle Theft': 'ದೂರುದಾರರು ತಮ್ಮ ದ್ವಿಚಕ್ರ ವಾಹನವನ್ನು {place} ಪಾರ್ಕಿಂಗ್‌ನಲ್ಲಿ ನಿಲ್ಲಿಸಿ ಹಿಂದಿರುಗಿದಾಗ ವಾಹನ ಕಾಣೆಯಾಗಿತ್ತು.',
  'Robbery': '{place} ಬಳಿ ನಿರ್ಜನ ರಸ್ತೆಯಲ್ಲಿ ಆರೋಪಿಗಳು ಮಾರಕಾಸ್ತ್ರ ತೋರಿಸಿ ಬೆದರಿಸಿ ನಗದು ಮತ್ತು ಮೊಬೈಲ್ ಕಸಿದುಕೊಂಡಿದ್ದಾರೆ.',
};
