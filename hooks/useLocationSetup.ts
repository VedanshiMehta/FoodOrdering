import { useState, useCallback, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { useDispatch, useSelector } from "react-redux";
import { setLocation } from "../store/slices/locationSlice";
import { RootState } from "../store/store";
import { Alert } from "react-native";

const GOOGLE_MAPS_API_KEY = "AIzaSyALqzmxQp3LvPfDzW-BkEqIvpVRjLG-fjc";
const DEFAULT_SEARCH_CITY = "Valsad";
const DEFAULT_SEARCH_STATE = "Gujarat";
const DEFAULT_SEARCH_COUNTRY = "India";
const DEFAULT_REGION = {
  latitude: 20.5992,
  longitude: 72.9342,
  latitudeDelta: 0.0012,
  longitudeDelta: 0.0012,
};

const fetchWithTimeout = async (url: string, timeoutMs = 5000) => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<any>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve({ status: "TIMEOUT", results: [], predictions: [] });
    }, timeoutMs);
  });

  const requestPromise = (async () => {
    try {
      const response = await fetch(url, { signal: controller.signal });
      return await response.json();
    } catch (error) {
      return { status: "ERROR", results: [], predictions: [] };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  })();

  return Promise.race([requestPromise, timeoutPromise]);
};

const geocodeWithGoogle = async (query: string) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in&components=country:IN&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url);
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        locationType: result.geometry.location_type,
      };
    }

    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log("Google Geocoding status:", data.status, data.error_message);
    }
  } catch (error) {
    console.error("Google Geocoding error:", error);
  }
  return null;
};

const searchPlaceWithGoogle = async (query: string) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=in&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url);

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress:
          result.formatted_address ||
          [result.name, result.vicinity].filter(Boolean).join(", "),
      };
    }

    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log("Google Places status:", data.status, data.error_message);
    }
  } catch (error) {
    console.error("Google Places error:", error);
  }
  return null;
};

const searchPlaceSuggestionsWithGoogle = async (query: string) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=in&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url, 2500);

    if (data.status === "OK" && data.results && data.results.length > 0) {
      return data.results.slice(0, 5).map((result: any) => ({
        placeId: result.place_id,
        primaryText: result.name || result.formatted_address,
        secondaryText: result.formatted_address || result.vicinity || "",
        description:
          result.formatted_address ||
          [result.name, result.vicinity].filter(Boolean).join(", "),
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress:
          result.formatted_address ||
          [result.name, result.vicinity].filter(Boolean).join(", "),
      }));
    }

    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log(
        "Google Text Search status:",
        data.status,
        data.error_message,
      );
    }
  } catch (error) {
    console.error("Google Text Search error:", error);
  }

  return [];
};

const fetchAutocompleteSuggestions = async (query: string) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:in&region=in&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url, 2500);

    if (
      data.status === "OK" &&
      data.predictions &&
      data.predictions.length > 0
    ) {
      return data.predictions.slice(0, 5).map((prediction: any) => ({
        placeId: prediction.place_id,
        primaryText:
          prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || "",
        description: prediction.description,
      }));
    }

    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log(
        "Google Autocomplete status:",
        data.status,
        data.error_message,
      );
    }
  } catch (error) {
    console.error("Google Autocomplete error:", error);
  }

  return [];
};

type GoogleLocationResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  locationType?: string;
};

export type AddressSuggestion = {
  placeId?: string;
  primaryText: string;
  secondaryText: string;
  description: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
};

const fetchAddressSuggestions = async (query: string) => {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 3) return [];

  const queries = buildSearchQueries(normalizedQuery);

  const autocompleteResults = await Promise.all(
    queries.map(fetchAutocompleteSuggestions),
  );
  const autocompleteSuggestions = autocompleteResults.find(
    (suggestions) => suggestions.length > 0,
  );
  if (autocompleteSuggestions) return autocompleteSuggestions;

  const textSearchResults = await Promise.all(
    queries.map(searchPlaceSuggestionsWithGoogle),
  );
  const textSearchSuggestions = textSearchResults.find(
    (suggestions) => suggestions.length > 0,
  );
  if (textSearchSuggestions) return textSearchSuggestions;

  const geocodeResults = await Promise.all(
    queries.map((searchQuery) => geocodeWithGoogle(searchQuery)),
  );
  const geocodeResult = geocodeResults.find(Boolean);

  if (geocodeResult) {
    const result = geocodeResult as GoogleLocationResult;

    return [
      {
        primaryText: normalizedQuery,
        secondaryText: result.formattedAddress,
        description: result.formattedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        formattedAddress: result.formattedAddress,
      },
    ];
  }

  return [];
};

const getPlaceDetails = async (placeId: string) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry,formatted_address,name,vicinity&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url);

    if (data.status === "OK" && data.result?.geometry?.location) {
      const result = data.result;
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress:
          result.formatted_address ||
          [result.name, result.vicinity].filter(Boolean).join(", "),
      };
    }

    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log(
        "Google Place Details status:",
        data.status,
        data.error_message,
      );
    }
  } catch (error) {
    console.error("Google Place Details error:", error);
  }

  return null;
};

function buildSearchQueries(query: string) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const lowerQuery = normalizedQuery.toLowerCase();
  const queries = [normalizedQuery];

  if (!lowerQuery.includes(DEFAULT_SEARCH_COUNTRY.toLowerCase())) {
    queries.push(`${normalizedQuery}, ${DEFAULT_SEARCH_COUNTRY}`);
  }

  if (
    !lowerQuery.includes(DEFAULT_SEARCH_CITY.toLowerCase()) &&
    !lowerQuery.includes(DEFAULT_SEARCH_STATE.toLowerCase())
  ) {
    queries.push(
      `${normalizedQuery}, ${DEFAULT_SEARCH_CITY}, ${DEFAULT_SEARCH_STATE}, ${DEFAULT_SEARCH_COUNTRY}`,
    );
  }

  return [...new Set(queries)];
}

const reverseGeocodeWithGoogle = async (
  latitude: number,
  longitude: number,
) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    const data = await fetchWithTimeout(url);
    if (data.status === "OK" && data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
  } catch (error) {
    console.error("Google Reverse Geocoding error:", error);
  }
  return null;
};

const reverseGeocodeWithNative = async (
  latitude: number,
  longitude: number,
) => {
  const geocode = await Location.reverseGeocodeAsync({
    latitude,
    longitude,
  });

  if (geocode.length === 0) return null;

  const place = geocode[0];
  return [
    place.name,
    place.street,
    place.district,
    place.city,
    place.region,
    place.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
};

const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number,
) => {
  const googleAddress = await reverseGeocodeWithGoogle(latitude, longitude);
  if (googleAddress) return googleAddress;

  return reverseGeocodeWithNative(latitude, longitude);
};

const getCoordinatesForAddress = async (query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  const searchQueries = buildSearchQueries(normalizedQuery);

  for (const searchQuery of searchQueries) {
    const placeResult = await searchPlaceWithGoogle(searchQuery);
    if (placeResult) return placeResult;
  }

  for (const searchQuery of searchQueries) {
    const geocodeResult = await geocodeWithGoogle(searchQuery);
    if (geocodeResult) return geocodeResult;
  }

  return null;
};

const getDistanceInMeters = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) => {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLng = toRadians(second.longitude - first.longitude);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useLocationSetup = () => {
  const dispatch = useDispatch();
  const savedLocation = useSelector((state: RootState) => state.location);

  const [currentRegion, setCurrentRegion] = useState({
    latitude: savedLocation.latitude || DEFAULT_REGION.latitude,
    longitude: savedLocation.longitude || DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  });
  const [address, setAddress] = useState<string | null>(savedLocation.address);
  const [flatHouseNo, setFlatHouseNo] = useState(
    savedLocation.flatHouseNo ?? "",
  );
  const [loading, setLoading] = useState(!savedLocation.latitude);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const programmaticMoveTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suggestionsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammaticMove = useRef(false);

  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);

    if (suggestionsTimeout.current) {
      clearTimeout(suggestionsTimeout.current);
    }

    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    suggestionsTimeout.current = setTimeout(async () => {
      const suggestions = await fetchAddressSuggestions(text);
      setAddressSuggestions(suggestions);
      setSuggestionsLoading(false);
    }, 350);
  }, []);

  const moveToSearchedLocation = (
    newRegion: typeof currentRegion,
    formattedAddress: string,
    mapRef: any,
  ) => {
    setCurrentRegion(newRegion);
    setAddress(formattedAddress);

    if (programmaticMoveTimeout.current) {
      clearTimeout(programmaticMoveTimeout.current);
    }

    isProgrammaticMove.current = true;

    if (mapRef && mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }

    programmaticMoveTimeout.current = setTimeout(() => {
      isProgrammaticMove.current = false;
    }, 1800);
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        setLoading(false);
        return;
      }

      if (!savedLocation.latitude || !savedLocation.longitude) {
        try {
          const location =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }));
          const newRegion = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0012,
            longitudeDelta: 0.0012,
          };
          setCurrentRegion(newRegion);
          await reverseGeocode(newRegion.latitude, newRegion.longitude);
        } catch (error) {
          setCurrentRegion(DEFAULT_REGION);
          setAddress(
            `${DEFAULT_SEARCH_CITY}, ${DEFAULT_SEARCH_STATE}, ${DEFAULT_SEARCH_COUNTRY}`,
          );
        } finally {
          setLoading(false);
        }
      } else {
        if (savedLocation.address) {
          const resolvedLocation = await getCoordinatesForAddress(
            savedLocation.address,
          );

          if (resolvedLocation) {
            const savedRegion = {
              latitude: savedLocation.latitude,
              longitude: savedLocation.longitude,
            };
            const resolvedRegion = {
              latitude: resolvedLocation.latitude,
              longitude: resolvedLocation.longitude,
            };
            const distance = getDistanceInMeters(savedRegion, resolvedRegion);

            if (distance > 75) {
              setCurrentRegion({
                ...resolvedRegion,
                latitudeDelta: 0.0012,
                longitudeDelta: 0.0012,
              });
              setAddress(resolvedLocation.formattedAddress);
            }
          }
        }

        setLoading(false);
      }
    })();
  }, []);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const formattedAddress = await getAddressFromCoordinates(
        latitude,
        longitude,
      );
      if (formattedAddress) {
        setAddress(formattedAddress);
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  const onRegionChangeComplete = async (region: any) => {
    setCurrentRegion(region);

    if (isProgrammaticMove.current) {
      return;
    }

    await reverseGeocode(region.latitude, region.longitude);
  };

  const searchAddress = async (query: string, mapRef: any) => {
    if (!query || query.trim() === "") {
      Alert.alert("Empty Search", "Please enter an address to search.");
      return;
    }

    setSearching(true);
    setAddressSuggestions([]);
    try {
      const searchQueries = buildSearchQueries(query);

      let approximateGoogleResult: GoogleLocationResult | null = null;

      // 1. Try Google Maps Geocoding first for exact typed addresses.
      for (const searchQuery of searchQueries) {
        const googleResults = await geocodeWithGoogle(searchQuery);
        if (!googleResults) continue;

        if (googleResults.locationType !== "ROOFTOP") {
          approximateGoogleResult = approximateGoogleResult ?? googleResults;
          continue;
        }

        const { latitude, longitude, formattedAddress } = googleResults;
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.0012,
          longitudeDelta: 0.0012,
        };

        moveToSearchedLocation(newRegion, formattedAddress, mapRef);
        setSearching(false);
        return;
      }

      // 2. Try Google Places; it is better for buildings/apartments.
      for (const searchQuery of searchQueries) {
        const placeResult = await searchPlaceWithGoogle(searchQuery);
        if (!placeResult) continue;

        const { latitude, longitude, formattedAddress } = placeResult;
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        };

        moveToSearchedLocation(newRegion, formattedAddress, mapRef);
        setSearching(false);
        return;
      }

      if (approximateGoogleResult) {
        const { latitude, longitude, formattedAddress } =
          approximateGoogleResult;
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.0012,
          longitudeDelta: 0.0012,
        };

        moveToSearchedLocation(newRegion, formattedAddress, mapRef);
        setSearching(false);
        return;
      }

      // 3. Fallback to native expo-location if Google APIs are unavailable.
      for (const searchQuery of searchQueries) {
        const results = await Location.geocodeAsync(searchQuery);
        if (!results || results.length === 0) continue;

        const { latitude, longitude } = results[0];
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.0012,
          longitudeDelta: 0.0012,
        };

        moveToSearchedLocation(newRegion, searchQuery, mapRef);
        setSearching(false);
        return;
      }

      Alert.alert(
        "Location Not Found",
        `Could not find "${query.trim()}". Try adding area, city, state, and country.`,
      );
    } catch (error) {
      console.error("Error geocoding address:", error);
      Alert.alert(
        "Error",
        "Something went wrong while searching for this location.",
      );
    } finally {
      setSearching(false);
    }
  };

  const selectAddressSuggestion = async (
    suggestion: AddressSuggestion,
    mapRef: any,
  ) => {
    setSearchQuery(suggestion.description);
    setAddressSuggestions([]);
    setSearching(true);

    try {
      if (
        typeof suggestion.latitude === "number" &&
        typeof suggestion.longitude === "number"
      ) {
        const newRegion = {
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        };

        moveToSearchedLocation(
          newRegion,
          suggestion.formattedAddress || suggestion.description,
          mapRef,
        );
        return;
      }

      if (!suggestion.placeId) {
        await searchAddress(suggestion.description, mapRef);
        return;
      }

      const placeDetails = await getPlaceDetails(suggestion.placeId);
      if (!placeDetails) {
        await searchAddress(suggestion.description, mapRef);
        return;
      }

      const { latitude, longitude, formattedAddress } = placeDetails;
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      };

      moveToSearchedLocation(newRegion, formattedAddress, mapRef);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    if (suggestionsTimeout.current) {
      clearTimeout(suggestionsTimeout.current);
    }

    setSearchQuery("");
    setAddressSuggestions([]);
    setSuggestionsLoading(false);
  };

  const locateCurrentPosition = async (mapRef: any) => {
    setCurrentLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow location permission.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0012,
        longitudeDelta: 0.0012,
      };
      const formattedAddress =
        (await getAddressFromCoordinates(
          newRegion.latitude,
          newRegion.longitude,
        )) || "Current location";

      setSearchQuery("");
      setAddressSuggestions([]);
      moveToSearchedLocation(newRegion, formattedAddress, mapRef);
    } catch (error) {
      console.error("Error fetching current location:", error);
      Alert.alert(
        "Location Unavailable",
        "Could not get your current location. Please check location services.",
      );
    } finally {
      setCurrentLocationLoading(false);
    }
  };

  const zoomIn = (mapRef: any) => {
    const nextLatitudeDelta = currentRegion.latitudeDelta / 2;
    const nextLongitudeDelta = currentRegion.longitudeDelta / 2;

    if (nextLatitudeDelta < 0.0001) return; // limit extreme zoom-in

    const newRegion = {
      ...currentRegion,
      latitudeDelta: nextLatitudeDelta,
      longitudeDelta: nextLongitudeDelta,
    };
    setCurrentRegion(newRegion);
    if (mapRef && mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  const zoomOut = (mapRef: any) => {
    const nextLatitudeDelta = currentRegion.latitudeDelta * 2;
    const nextLongitudeDelta = currentRegion.longitudeDelta * 2;

    if (nextLatitudeDelta > 50) return; // limit extreme zoom-out

    const newRegion = {
      ...currentRegion,
      latitudeDelta: nextLatitudeDelta,
      longitudeDelta: nextLongitudeDelta,
    };
    setCurrentRegion(newRegion);
    if (mapRef && mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  const confirmLocation = () => {
    dispatch(
      setLocation({
        latitude: currentRegion.latitude,
        longitude: currentRegion.longitude,
        address: address,
        flatHouseNo: flatHouseNo.trim() || null,
      }),
    );
  };

  return {
    currentRegion,
    address,
    setAddress,
    flatHouseNo,
    setFlatHouseNo,
    loading,
    searchQuery,
    setSearchQuery: handleSearchQueryChange,
    addressSuggestions,
    suggestionsLoading,
    searching,
    currentLocationLoading,
    onRegionChangeComplete,
    searchAddress,
    selectAddressSuggestion,
    clearSearch,
    locateCurrentPosition,
    zoomIn,
    zoomOut,
    confirmLocation,
  };
};
