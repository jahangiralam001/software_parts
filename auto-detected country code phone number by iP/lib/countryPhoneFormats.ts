// Country phone number format specifications
// Format: countryCode -> { expectedDigits, callingCode, example, format }
export const COUNTRY_PHONE_FORMATS: {
  [key: string]: {
    expectedDigits: number;
    format: string;
    example: string;
  };
} = {
  "US": {
    expectedDigits: 10,
    format: "+1 (XXX) XXX-XXXX",
    example: "+1 (202) 555-0173",
  },
  "GB": {
    expectedDigits: 10,
    format: "+44 XXXX XXX XXX",
    example: "+44 2071 838750",
  },
  "CA": {
    expectedDigits: 10,
    format: "+1 (XXX) XXX-XXXX",
    example: "+1 (416) 555-0173",
  },
  "BD": {
    expectedDigits: 10,
    format: "+880 1XXX-XXXXXX",
    example: "+880 1813456789",
  },
  "GH": {
    expectedDigits: 9,
    format: "+233 XX XXXXXX",
    example: "+233 24 1234567",
  },
  "NG": {
    expectedDigits: 10,
    format: "+234 XXX XXX XXXX",
    example: "+234 801 555 1234",
  },
  "PK": {
    expectedDigits: 10,
    format: "+92 3XX XXXXXXX",
    example: "+92 300 1234567",
  },
  "IN": {
    expectedDigits: 10,
    format: "+91 XXXXX XXXXX",
    example: "+91 98765 43210",
  },
  "CN": {
    expectedDigits: 11,
    format: "+86 1XX XXXX XXXX",
    example: "+86 186 1234 5678",
  },
  "JP": {
    expectedDigits: 10,
    format: "+81 XX XXXX XXXX",
    example: "+81 90 1234 5678",
  },
  "KR": {
    expectedDigits: 10,
    format: "+82 10 XXXX XXXX",
    example: "+82 10 1234 5678",
  },
  "AU": {
    expectedDigits: 9,
    format: "+61 4XX XXX XXX",
    example: "+61 412 345 678",
  },
  "NZ": {
    expectedDigits: 9,
    format: "+64 2X XXX XXXX",
    example: "+64 21 234 5678",
  },
  "FR": {
    expectedDigits: 9,
    format: "+33 X XX XX XX XX",
    example: "+33 1 23 45 67 89",
  },
  "DE": {
    expectedDigits: 11,
    format: "+49 XXX XXXXXXXX",
    example: "+49 123 456789012",
  },
  "IT": {
    expectedDigits: 10,
    format: "+39 XXX XXX XXXX",
    example: "+39 123 456 7890",
  },
  "ES": {
    expectedDigits: 9,
    format: "+34 XXX XX XX XX",
    example: "+34 912 34 56 78",
  },
  "MX": {
    expectedDigits: 10,
    format: "+52 55 XXXX XXXX",
    example: "+52 55 1234 5678",
  },
  "BR": {
    expectedDigits: 11,
    format: "+55 11 9XXXX-XXXX",
    example: "+55 11 912345678",
  },
  "AR": {
    expectedDigits: 10,
    format: "+54 9 XX XXXX XXXX",
    example: "+54 9 11 1234 5678",
  },
  "ZA": {
    expectedDigits: 9,
    format: "+27 XX XXX XXXX",
    example: "+27 72 123 4567",
  },
  "SE": {
    expectedDigits: 9,
    format: "+46 7X XXX XXXX",
    example: "+46 70 123 4567",
  },
  "NO": {
    expectedDigits: 8,
    format: "+47 XXXX XXXX",
    example: "+47 9012 3456",
  },
  "DK": {
    expectedDigits: 8,
    format: "+45 XXXX XXXX",
    example: "+45 4012 3456",
  },
  "FI": {
    expectedDigits: 9,
    format: "+358 4X XXX XXXX",
    example: "+358 40 123 4567",
  },
  "NL": {
    expectedDigits: 9,
    format: "+31 6 XXXX XXXX",
    example: "+31 6 1234 5678",
  },
  "BE": {
    expectedDigits: 9,
    format: "+32 4XX XXX XXX",
    example: "+32 412 345 678",
  },
  "CH": {
    expectedDigits: 9,
    format: "+41 7X XXX XXXX",
    example: "+41 76 123 4567",
  },
  "AT": {
    expectedDigits: 10,
    format: "+43 6XX XXXXXX",
    example: "+43 660 1234567",
  },
  "PL": {
    expectedDigits: 9,
    format: "+48 XXX XXX XXX",
    example: "+48 123 456 789",
  },
  "RU": {
    expectedDigits: 11,
    format: "+7 9XX XXX XX XX",
    example: "+7 912 345 67 89",
  },
  "UA": {
    expectedDigits: 9,
    format: "+380 XX XXX XX XX",
    example: "+380 50 123 45 67",
  },
  "TR": {
    expectedDigits: 10,
    format: "+90 5XX XXX XXXX",
    example: "+90 501 234 5678",
  },
  "EG": {
    expectedDigits: 10,
    format: "+20 1XX XXX XXXX",
    example: "+20 100 123 4567",
  },
  "SA": {
    expectedDigits: 9,
    format: "+966 5X XXX XXXX",
    example: "+966 50 123 4567",
  },
  "AE": {
    expectedDigits: 9,
    format: "+971 5X XXX XXXX",
    example: "+971 50 123 4567",
  },
  "IL": {
    expectedDigits: 9,
    format: "+972 5X XXX XXXX",
    example: "+972 50 123 4567",
  },
  "SG": {
    expectedDigits: 8,
    format: "+65 XXXX XXXX",
    example: "+65 8123 4567",
  },
  "MY": {
    expectedDigits: 10,
    format: "+60 1X XXXX XXXX",
    example: "+60 12 3456 7890",
  },
  "TH": {
    expectedDigits: 9,
    format: "+66 8X XXX XXXX",
    example: "+66 81 234 5678",
  },
  "PH": {
    expectedDigits: 10,
    format: "+63 9XX XXX XXXX",
    example: "+63 912 345 6789",
  },
  "ID": {
    expectedDigits: 10,
    format: "+62 8XX XXX XXXX",
    example: "+62 812 345 6789",
  },
  "VN": {
    expectedDigits: 9,
    format: "+84 9X XXX XXXX",
    example: "+84 91 234 5678",
  },
  "TW": {
    expectedDigits: 9,
    format: "+886 9XX XXX XXX",
    example: "+886 912 345 678",
  },
  "HK": {
    expectedDigits: 8,
    format: "+852 XXXX XXXX",
    example: "+852 1234 5678",
  },
  "KE": {
    expectedDigits: 9,
    format: "+254 7XX XXX XXX",
    example: "+254 712 345 678",
  },
  "GR": {
    expectedDigits: 10,
    format: "+30 69X XXX XXXX",
    example: "+30 691 234 5678",
  },
  "PT": {
    expectedDigits: 9,
    format: "+351 9XX XXX XXX",
    example: "+351 912 345 678",
  },
  "IE": {
    expectedDigits: 9,
    format: "+353 8X XXXX XXXX",
    example: "+353 83 1234 5678",
  },
  "CZ": {
    expectedDigits: 9,
    format: "+420 7XX XXX XXX",
    example: "+420 721 234 567",
  },
  "HU": {
    expectedDigits: 9,
    format: "+36 20 XXX XXXX",
    example: "+36 20 123 4567",
  },
  "RO": {
    expectedDigits: 9,
    format: "+40 7X XXX XXXX",
    example: "+40 70 123 4567",
  },
  "BG": {
    expectedDigits: 9,
    format: "+359 87 XXX XXXX",
    example: "+359 87 123 4567",
  },
  "HR": {
    expectedDigits: 9,
    format: "+385 1 XXXX XXXX",
    example: "+385 1 1234 5678",
  },
  "SI": {
    expectedDigits: 9,
    format: "+386 41 XXXX XXXX",
    example: "+386 41 123 4567",
  },
  "SK": {
    expectedDigits: 9,
    format: "+421 900 XXX XXX",
    example: "+421 900 123 456",
  },
  "LT": {
    expectedDigits: 8,
    format: "+370 6XX XXXXX",
    example: "+370 612 34567",
  },
  "LV": {
    expectedDigits: 8,
    format: "+371 2X XXX XXXX",
    example: "+371 20 123 456",
  },
  "EE": {
    expectedDigits: 8,
    format: "+372 5XX XXXXX",
    example: "+372 512 34567",
  },
  "CL": {
    expectedDigits: 9,
    format: "+56 9 XXXX XXXX",
    example: "+56 9 1234 5678",
  },
  "CO": {
    expectedDigits: 10,
    format: "+57 3XX XXX XXXX",
    example: "+57 312 345 6789",
  },
  "PE": {
    expectedDigits: 9,
    format: "+51 9XX XXX XXX",
    example: "+51 912 345 678",
  },
  "VE": {
    expectedDigits: 10,
    format: "+58 4XX XXX XXXX",
    example: "+58 412 345 6789",
  },
  "NI": {
    expectedDigits: 8,
    format: "+505 XXXX XXXX",
    example: "+505 8123 4567",
  },
  "PA": {
    expectedDigits: 8,
    format: "+507 6XXX XXXX",
    example: "+507 6123 4567",
  },
  "AL": {
    expectedDigits: 9,
    format: "+355 6X XXX XXXX",
    example: "+355 69 123 4567",
  },
};

// Get phone number format info for a country
export function getCountryPhoneFormat(countryCode: string) {
  return COUNTRY_PHONE_FORMATS[countryCode] || null;
}

// Check if a number has expected length or close to it
export function getPhoneLengthInfo(
  countryCode: string,
  userDigits: number
): {
  expected: number | null;
  difference: number;
  status: "too-short" | "too-long" | "correct" | "unknown";
} {
  const format = getCountryPhoneFormat(countryCode);
  
  // Use mapped format, or fallback to reasonable default for unmapped countries
  const expectedDigits = format?.expectedDigits || getDefaultExpectedDigits(countryCode);
  
  if (!format && !expectedDigits) {
    return {
      expected: null,
      difference: 0,
      status: "unknown",
    };
  }

  const difference = userDigits - expectedDigits;
  
  let status: "too-short" | "too-long" | "correct" = "correct";
  if (difference < 0) {
    status = "too-short";
  } else if (difference > 0) {
    status = "too-long";
  }

  return {
    expected: expectedDigits,
    difference: Math.abs(difference),
    status,
  };
}

// Get a reasonable default expected digit count for countries not in the map
function getDefaultExpectedDigits(countryCode: string): number {
  // Most countries use 9-10 digits; use 10 as a safe default
  // Countries with shorter formats (8 digits): DK, NO, FI, SG, HK, etc.
  const shortFormatCountries = ["DK", "NO", "FI", "SG", "HK", "LT", "LV", "EE", "NI", "PA"];
  if (shortFormatCountries.includes(countryCode)) {
    return 8;
  }
  // Countries with longer formats (11+ digits): CN, DE, BR, RU, etc.
  const longFormatCountries = ["CN", "DE", "BR", "RU"];
  if (longFormatCountries.includes(countryCode)) {
    return 11;
  }
  // Default to 10 for most countries
  return 10;
}
