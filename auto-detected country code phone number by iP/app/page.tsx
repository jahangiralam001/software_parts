"use client";

import { useState, useEffect } from "react";
import { getCallingCode, getFlagEmoji } from "../lib/countryPrefixes";
import { getCountryPhoneFormat, getPhoneLengthInfo } from "../lib/countryPhoneFormats";
import countriesData from "world-countries";
import { parsePhoneNumber, isValidPhoneNumber, isPossiblePhoneNumber } from "libphonenumber-js";

type LocationData = {
  countryCode: string | null;
  countryName: string | null;
  callingCode: string | null;
  ip: string | null;
};

type ValidationResult = {
  isValid: boolean;
  fullNumber: string;
  reason: string;
  debug?: string;
} | null;

// Generate country list from world-countries library
const COUNTRY_LIST = countriesData
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    flag: getFlagEmoji(country.cca2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function HomePage() {
  const [locationData, setLocationData] = useState<LocationData>({
    countryCode: null,
    countryName: null,
    callingCode: null,
    ip: null,
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>(null);
  const [phoneNumberWarning, setPhoneNumberWarning] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".country-search")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const getUserLocation = async () => {
      try {
        // Call our server-side API route
        const res = await fetch("/api/location");
        if (!res.ok) throw new Error("Failed to fetch location");
        
        const data = await res.json();
        console.log("Server location data:", data);

        // If server detected a real IP (not localhost), use it
        if (data.countryCode && data.countryCode !== 'unknown') {
          const countryCode = data.countryCode;
          const callingCode = getCallingCode(countryCode);
          
          setLocationData({
            countryCode,
            countryName: data.countryName || null,
            callingCode,
            ip: data.ip || null,
          });
          setSelectedCountryCode(countryCode);
          setLoading(false);
          return;
        }

        // Fallback: Try using ipinfo.io (CORS-friendly, works on localhost)
        console.log("Server returned local IP, trying client-side fallback...");
        const fallbackRes = await fetch("https://ipinfo.io/json?token=4f4a7f9890a301");
        const fallbackData = await fallbackRes.json();
        console.log("ipinfo.io data:", fallbackData);

        const countryCode = fallbackData.country || null;
        const callingCode = getCallingCode(countryCode || undefined);

        setLocationData({
          countryCode,
          countryName: fallbackData.country_name || fallbackData.country || null,
          callingCode,
          ip: fallbackData.ip || data.ip || null,
        });
        if (countryCode) {
          setSelectedCountryCode(countryCode);
        }
      } catch (error) {
        console.error("Location fetch error:", error);
        setLocationData({
          countryCode: null,
          countryName: null,
          callingCode: null,
          ip: null,
        });
      } finally {
        setLoading(false);
      }
    };

    getUserLocation();
  }, []);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountryCode = e.target.value;
    setSelectedCountryCode(newCountryCode);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setShowDropdown(true);
  };

  const handleSelectCountry = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    setSearchInput("");
    setShowDropdown(false);
    setPhoneNumberWarning(null); // Clear warning when country changes
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    
    // Check if user entered too many digits
    if (selectedCountryCode) {
      const phoneFormat = getCountryPhoneFormat(selectedCountryCode);
      const lengthInfo = getPhoneLengthInfo(selectedCountryCode, 0); // Get country info
      const expectedDigits = phoneFormat?.expectedDigits || lengthInfo.expected;
      
      if (expectedDigits) {
        const normalizedDigits = value.replace(/\D/g, "").replace(/^0+/, "");
        const userDigits = normalizedDigits.length;
        
        if (userDigits > expectedDigits) {
          setPhoneNumberWarning(
            `⚠️ Too many digits! ${selectedCountryCode} expects ${expectedDigits} digits, but you entered ${userDigits}. Please remove ${userDigits - expectedDigits} digit(s).`
          );
        } else {
          setPhoneNumberWarning(null);
        }
      }
    }
  };

  const handlePhoneNumberKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && phoneNumber && selectedCountryCode) {
      e.preventDefault();
      handleValidateNumber();
    }
  };

  const buildDebugInfo = (
    rawNumber: string,
    countryCode: string,
    parsedNumber: ReturnType<typeof parsePhoneNumber> | null
  ) => {
    const numberType = parsedNumber?.getType?.() || "UNKNOWN";
    const nationalNumber = parsedNumber?.nationalNumber?.toString() || "N/A";
    const possible = isPossiblePhoneNumber(rawNumber, countryCode as any) ? "Yes" : "No";
    const valid = isValidPhoneNumber(rawNumber, countryCode as any) ? "Yes" : "No";

    return `Type: ${numberType.replace(/_/g, " ")}
National: ${nationalNumber}
Valid: ${valid}
Possible: ${possible}`;
  };

  const buildInvalidReason = (baseReason: string, countryCode?: string) => {
    if (!countryCode || baseReason.includes("\n\nFormat:")) {
      return baseReason;
    }

    const phoneFormat = getCountryPhoneFormat(countryCode);
    if (phoneFormat) {
      return `${baseReason}\n\nFormat: ${phoneFormat.format}\nExample: ${phoneFormat.example}`;
    }

    const fallbackCallingCode = getCallingCode(countryCode || undefined) || currentCallingCode || "+";
    const normalizedDigits = phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
    const fallbackDigits = Math.min(12, Math.max(6, normalizedDigits.length || 9));
    const fallbackFormat = `${fallbackCallingCode} ${"X".repeat(fallbackDigits)}`;
    const fallbackExample = `${fallbackCallingCode} ${"1".repeat(fallbackDigits)}`;

    return `${baseReason}\n\nFormat: ${fallbackFormat}\nExample: ${fallbackExample}`;
  };

  const handleValidateNumber = () => {
    if (!phoneNumber || !selectedCountryCode) {
      setValidationResult({
        isValid: false,
        fullNumber: "",
        reason: buildInvalidReason("Please enter a valid phone number and select a country.", selectedCountryCode),
      });
      return;
    }

    let parsedNumber: ReturnType<typeof parsePhoneNumber> | null = null;

    try {
      const countryName = currentCountry?.name || selectedCountryCode;

      try {
        parsedNumber = parsePhoneNumber(phoneNumber, selectedCountryCode as any);
      } catch (parseError) {
        parsedNumber = null;
      }

      const fullNumber = parsedNumber?.formatInternational() || `${currentCallingCode} ${phoneNumber}`;
      
      const isPossible = isPossiblePhoneNumber(phoneNumber, selectedCountryCode as any);
      const isStrictlyValid = isValidPhoneNumber(phoneNumber, selectedCountryCode as any);

      if (isStrictlyValid || isPossible) {
        const parsed = parsedNumber || parsePhoneNumber(phoneNumber, selectedCountryCode as any);
        const numberType = parsed?.getType?.();
        const isAllowedType =
          numberType === "MOBILE" ||
          numberType === "FIXED_LINE" ||
          numberType === "FIXED_LINE_OR_MOBILE" ||
          !numberType;

        const debugInfo = buildDebugInfo(phoneNumber, selectedCountryCode, parsed);

        if (isAllowedType) {
          if (isStrictlyValid) {
            setValidationResult({
              isValid: true,
              fullNumber: parsed?.formatInternational() || fullNumber,
              reason: "Phone number is valid for the selected country.",
              debug: debugInfo,
            });
          } else {
            setValidationResult({
              isValid: false,
              fullNumber: parsed?.formatInternational() || fullNumber,
              reason: buildInvalidReason(
                `This number is only possible by length, but invalid for ${countryName} pattern rules.`,
                selectedCountryCode
              ),
              debug: debugInfo,
            });
          }
        } else {
          const typeLabel = numberType ? numberType.replace(/_/g, " ").toLowerCase() : "non-mobile";
          setValidationResult({
            isValid: false,
            fullNumber: parsed?.formatInternational() || fullNumber,
            reason: buildInvalidReason(
              `Only mobile or fixed-line numbers are accepted. This appears to be ${typeLabel} for ${countryName}.`,
              selectedCountryCode
            ),
            debug: debugInfo,
          });
        }
      } else {
        let reason = "Invalid phone number format for the selected country.";
        const debugInfo = buildDebugInfo(phoneNumber, selectedCountryCode, parsedNumber);
        
        try {
          const normalizedDigits = phoneNumber.replace(/\D/g, "").replace(/^0+/, "");
          const userDigits = parsedNumber?.nationalNumber
            ? parsedNumber.nationalNumber.toString().length
            : normalizedDigits.length;
          const lengthInfo = getPhoneLengthInfo(selectedCountryCode, userDigits);
          const phoneFormat = getCountryPhoneFormat(selectedCountryCode);
          
          if (lengthInfo.status === "unknown") {
            // If we don't have data for this country, try to parse and estimate
            try {
              const parsed = parsedNumber || parsePhoneNumber(phoneNumber, selectedCountryCode as any);
              if (parsed) {
                const nationalNumber = parsed.nationalNumber?.toString() || "";
                const expectedDigits = nationalNumber.length;
                
                if (userDigits < expectedDigits) {
                  reason = `${countryName} usually has ${expectedDigits} digits after the country code. You provided ${userDigits} digits, so it's missing ${expectedDigits - userDigits} digit(s). Please add ${expectedDigits - userDigits} more digit(s) to make it valid.`;
                } else if (userDigits > expectedDigits) {
                  reason = `${countryName} usually has ${expectedDigits} digits after the country code. You provided ${userDigits} digits, so it has ${userDigits - expectedDigits} extra digit(s). Please remove ${userDigits - expectedDigits} digit(s) to make it valid.`;
                } else {
                  reason = `${countryName} expects ${expectedDigits} digits after the country code. You provided exactly ${expectedDigits} digits, but the format is still invalid. Please check the digit pattern.`;
                }
              }
            } catch (parseError) {
              reason = `${countryName}: Invalid phone number format. Please check the format for this country.`;
            }
          } else {
            // Use our country-specific data
            const { expected, difference, status } = lengthInfo;
            const formatStr = phoneFormat?.format || "";
            const example = phoneFormat?.example || "";
            
            if (status === "too-short") {
              reason = `${countryName} expects ${expected} digits after the country code. You provided ${userDigits} digits, which is ${difference} digit(s) short. Please add ${difference} more digit(s).\n\nFormat: ${formatStr}\nExample: ${example}`;
            } else if (status === "too-long") {
              reason = `${countryName} expects ${expected} digits after the country code. You provided ${userDigits} digits, which is ${difference} digit(s) too many. Please remove ${difference} digit(s).\n\nFormat: ${formatStr}\nExample: ${example}`;
            } else {
              reason = `${countryName} expects ${expected} digits after the country code. You provided exactly ${expected} digits, but the number format is still invalid for this country. Please check the digit pattern.\n\nFormat: ${formatStr}\nExample: ${example}`;
            }
          }
        } catch (e) {
          const userDigits = phoneNumber.replace(/\D/g, "").length;
          
          if (userDigits === 0) {
            reason = `${countryName}: Please enter only digits in the phone number field.`;
          } else {
            reason = `${countryName}: Invalid phone number format. Please check the format for this country.`;
          }
        }
        
        setValidationResult({
          isValid: false,
          fullNumber: fullNumber,
          reason: buildInvalidReason(reason, selectedCountryCode),
          debug: debugInfo,
        });
      }
    } catch (error) {
      const countryName = currentCountry?.name || selectedCountryCode;
      let reason = "Invalid phone number format or country code.";
      const debugInfo = buildDebugInfo(phoneNumber, selectedCountryCode, parsedNumber);
      
      if (phoneNumber.length === 0) {
        reason = `${countryName}: Phone number field is empty.`;
      } else if (phoneNumber.replace(/\D/g, "").length === 0) {
        reason = `${countryName}: Please enter only digits in the phone number field.`;
      }
      
      setValidationResult({
        isValid: false,
        fullNumber: parsedNumber?.formatInternational() || `${currentCallingCode} ${phoneNumber}`,
        reason: buildInvalidReason(reason, selectedCountryCode),
        debug: debugInfo,
      });
    }
  };

  // Filter countries based on search input
  const filteredCountries = COUNTRY_LIST.filter((country) => {
    const searchLower = searchInput.toLowerCase();
    return (
      country.name.toLowerCase().includes(searchLower) ||
      country.code.toLowerCase().includes(searchLower)
    );
  });

  const currentCountry = COUNTRY_LIST.find(c => c.code === selectedCountryCode);
  const currentCallingCode = getCallingCode(selectedCountryCode || undefined);

  // 👇 HARD CODE YOUR DETAILS HERE
  const fullName = "Limin Ahmed";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT SIDE - FORM */}
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
                {fullName}
              </h1>
            </div>

            {!loading && (
              <div className="space-y-4">
                <div className="country-search">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Country
                  </label>
                  <div className="relative">
                    <div className="flex items-center px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900">
                      <input
                        type="text"
                        placeholder="Search country..."
                        value={searchInput || (selectedCountryCode ? COUNTRY_LIST.find(c => c.code === selectedCountryCode)?.name || "" : "")}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onFocus={() => setShowDropdown(true)}
                        className="w-full bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
                      />
                    </div>

                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 shadow-lg z-10">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              onClick={() => handleSelectCountry(country.code)}
                              className="w-full text-left px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0"
                            >
                              <span className="text-lg mr-2">{country.flag}</span>
                              <span>{country.name}</span>
                              <span className="text-xs text-neutral-500 ml-2">({country.code})</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-neutral-500 dark:text-neutral-400 text-center">
                            No countries found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                

                {selectedCountryCode && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Country Code
                    </label>
                    <div className="flex items-center px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                      <span className="text-2xl mr-2">{currentCountry?.flag}</span>
                      <div className="flex-1">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{currentCountry?.name}</span>
                        <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                          {currentCallingCode || "N/A"}
                        </div>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {selectedCountryCode}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="17XX-XXXXXX"
                    value={phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    onKeyPress={handlePhoneNumberKeyPress}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 ${
                      phoneNumberWarning
                        ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                        : "border-neutral-300 dark:border-neutral-600 focus:ring-blue-500"
                    }`}
                  />
                  {phoneNumberWarning && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {phoneNumberWarning}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleValidateNumber}
                  disabled={!phoneNumber || !selectedCountryCode}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                >
                  Check number
                </button>

                {phoneNumber && currentCallingCode && (
                  <div className="pt-2 text-center">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Full: <span className="font-semibold">{currentCallingCode} {phoneNumber}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-6">
              <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800" />
            </div>

            {!loading && (
              <div className="space-y-2 text-center lg:text-left text-sm text-neutral-500 dark:text-neutral-400">
                {locationData.countryName && (
                  <p>
                    Detected Country: <span className="font-semibold text-neutral-600 dark:text-neutral-300">{locationData.countryName}</span>
                  </p>
                )}
                {locationData.ip && (
                  <p>
                    IP Address: <span className="font-semibold text-neutral-600 dark:text-neutral-300">{locationData.ip}</span>
                  </p>
                )}
                {!locationData.countryName && !locationData.ip && (
                  <p className="text-orange-600 dark:text-orange-400">Unable to detect location</p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDE - VALIDATION RESULTS */}
          <div className="flex items-center justify-center">
            {validationResult && (
              <div className={`w-full p-8 rounded-lg border-2 ${
                validationResult.isValid
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : "border-red-500 bg-red-50 dark:bg-red-900/20"
              }`}>
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Validation Result
                  </h2>
                  
                  <div className="space-y-3">
                    <div>
                      <p className={`text-sm font-medium ${
                        validationResult.isValid
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        Full Number:
                      </p>
                      <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
                        {validationResult.fullNumber}
                      </p>
                    </div>

                    <div>
                      <p className={`text-sm font-medium ${
                        validationResult.isValid
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        Number Status:
                      </p>
                      <p className={`text-lg font-semibold mt-1 ${
                        validationResult.isValid
                          ? "text-green-600 dark:text-green-300"
                          : "text-red-600 dark:text-red-300"
                      }`}>
                        {validationResult.isValid ? "Valid ✓" : "Invalid ✗"}
                      </p>
                    </div>

                    <div>
                      <p className={`text-sm font-medium ${
                        validationResult.isValid
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        Reason:
                      </p>
                      <p className="text-neutral-700 dark:text-neutral-300 mt-1 whitespace-pre-wrap">
                        {validationResult.reason}
                      </p>
                    </div>

                    {validationResult.debug && (
                      <div>
                        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Debug</p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mt-1">
                          {validationResult.debug}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!validationResult && (
              <div className="w-full p-8 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-center">
                <p className="text-neutral-500 dark:text-neutral-400">
                  Enter a phone number and click "Check number" to validate
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
