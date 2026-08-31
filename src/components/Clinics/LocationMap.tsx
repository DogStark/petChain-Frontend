import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Navigation,
  Loader2,
  AlertTriangle,
  Map,
  Crosshair,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ClinicLocation } from "@/types/clinic";

interface LocationMapProps {
  locations: ClinicLocation[];
}

type MapState = "idle" | "loading" | "loaded" | "error" | "no-geolocation";

interface UserLocation {
  lat: number;
  lng: number;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function getMapBounds(
  locations: ClinicLocation[],
  userLocation?: UserLocation | null
) {
  const coords = locations
    .filter((l) => l.coordinates)
    .map((l) => l.coordinates!);

  if (userLocation) {
    coords.push(userLocation);
  }

  if (coords.length === 0) {
    return { centerLat: 51.5072, centerLng: -0.1276, zoom: 12 };
  }

  const minLat = Math.min(...coords.map((c) => c.lat));
  const maxLat = Math.max(...coords.map((c) => c.lat));
  const minLng = Math.min(...coords.map((c) => c.lng));
  const maxLng = Math.max(...coords.map((c) => c.lng));

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  const maxDiff = Math.max(latDiff, lngDiff);

  let zoom = 12;
  if (maxDiff > 0.5) zoom = 10;
  else if (maxDiff > 0.1) zoom = 11;
  else if (maxDiff < 0.01) zoom = 14;

  return { centerLat, centerLng, zoom };
}

function projectToPixel(
  lat: number,
  lng: number,
  bounds: ReturnType<typeof getMapBounds>,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  const latRange = 0.01 * Math.pow(2, 14 - bounds.zoom);
  const lngRange = latRange * (containerWidth / containerHeight);

  const x =
    ((lng - bounds.centerLng + lngRange / 2) / lngRange) * containerWidth;
  const y =
    ((bounds.centerLat - lat + latRange / 2) / latRange) * containerHeight;

  return {
    x: Math.max(0, Math.min(containerWidth, x)),
    y: Math.max(0, Math.min(containerHeight, y)),
  };
}

export default function LocationMap({ locations }: LocationMapProps) {
  const [mapState, setMapState] = useState<MapState>("idle");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geolocationSupported, setGeolocationSupported] = useState(true);
  const [consentRequested, setConsentRequested] = useState(false);
  const [consentDenied, setConsentDenied] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });

  const locationsWithCoords = locations.filter((l) => l.coordinates);
  const locationsWithoutCoords = locations.filter((l) => !l.coordinates);
  const allLocations = [...locationsWithCoords, ...locationsWithoutCoords];

  const sortedLocations = userLocation
    ? [...allLocations].sort((a, b) => {
        if (!a.coordinates) return 1;
        if (!b.coordinates) return -1;
        const distA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.coordinates.lat,
          a.coordinates.lng
        );
        const distB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.coordinates.lat,
          b.coordinates.lng
        );
        return distA - distB;
      })
    : allLocations;

  const mapBounds = getMapBounds(locationsWithCoords, userLocation);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocationSupported(false);
      setMapState("no-geolocation");
      return;
    }

    setMapState("loading");
    const timeout = setTimeout(() => {
      setMapState("loaded");
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocationSupported(false);
      setMapState("no-geolocation");
      return;
    }

    setConsentRequested(true);
    setMapState("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setMapState("loaded");
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setConsentDenied(true);
            setMapState("no-geolocation");
            break;
          case error.POSITION_UNAVAILABLE:
          case error.TIMEOUT:
          default:
            setMapState("error");
            break;
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const handleRetry = useCallback(() => {
    setUserLocation(null);
    setConsentRequested(false);
    setConsentDenied(false);
    setMapState("loading");
    setTimeout(() => {
      setMapState("loaded");
    }, 1000);
  }, []);

  const handleLocationClick = useCallback((locationId: string) => {
    setActiveLocation((prev) => (prev === locationId ? null : locationId));
    setExpandedLocation((prev) => (prev === locationId ? null : locationId));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, locationId: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleLocationClick(locationId);
      }
    },
    [handleLocationClick]
  );

  const getNavigateUrl = (location: ClinicLocation) => {
    if (location.coordinates) {
      return `https://www.google.com/maps/dir/?api=1&destination=${location.coordinates.lat},${location.coordinates.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${location.address}, ${location.city}`
    )}`;
  };

  const getCallUrl = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Map Area */}
      <div
        className="bg-blue-50 rounded-3xl overflow-hidden relative min-h-[300px] lg:min-h-[400px]"
        role="region"
        aria-label="Clinic location map"
        aria-live="polite"
      >
        {mapState === "loading" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50 z-10"
            role="status"
            aria-label="Map loading"
          >
            <Loader2
              className="w-10 h-10 text-blue-500 animate-spin mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-blue-700">
              Loading map...
            </p>
            <p className="text-xs text-blue-500 mt-1">
              {consentRequested && !userLocation
                ? "Requesting your location..."
                : "Preparing clinic locations"}
            </p>
          </div>
        )}

        {mapState === "error" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 z-10 p-6"
            role="alert"
            aria-label="Map failed to load"
          >
            <AlertTriangle
              className="w-10 h-10 text-red-400 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-red-700 mb-1">
              Map unavailable
            </p>
            <p className="text-xs text-red-500 text-center mb-4">
              The map could not be loaded. You can still view clinic details in
              the list below.
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        )}

        {mapState === "no-geolocation" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 p-6"
            role="status"
            aria-label="Location not available"
          >
            <Map
              className="w-10 h-10 text-gray-400 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {consentDenied
                ? "Location access denied"
                : !geolocationSupported
                ? "Location not supported"
                : "Location unavailable"}
            </p>
            <p className="text-xs text-gray-500 text-center mb-4">
              {consentDenied
                ? "You denied location access. You can still browse clinic locations in the list below."
                : !geolocationSupported
                ? "Your browser doesn't support geolocation. Clinic locations are shown in the list below."
                : "We couldn't determine your location. Clinic locations are shown in the list below."}
            </p>
            <div className="flex gap-2">
              {!consentDenied && geolocationSupported && (
                <button
                  onClick={requestLocation}
                  className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Crosshair className="w-4 h-4 inline mr-1" />
                  Try Again
                </button>
              )}
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Refresh Map
              </button>
            </div>
          </div>
        )}

        {(mapState === "idle" || mapState === "loaded") && (
          <>
            <div
              ref={mapContainerRef}
              className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-green-50"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/-0.1276,51.5072,12/800x600?access_token=none')] bg-cover bg-center opacity-30" />
            </div>

            {locationsWithCoords.map((loc) => {
              if (!loc.coordinates || !mapContainerRef.current) return null;
              const pos = projectToPixel(
                loc.coordinates.lat,
                loc.coordinates.lng,
                mapBounds,
                containerSize.width,
                containerSize.height
              );
              const isHovered = hoveredLocation === loc.id;
              const isActive = activeLocation === loc.id;

              return (
                <button
                  key={loc.id}
                  type="button"
                  className={`absolute transform -translate-x-1/2 -translate-y-full transition-all duration-200 z-20 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-full ${
                    isHovered || isActive ? "scale-125" : "scale-100"
                  }`}
                  style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  onClick={() => handleLocationClick(loc.id)}
                  onMouseEnter={() => setHoveredLocation(loc.id)}
                  onMouseLeave={() => setHoveredLocation(null)}
                  onKeyDown={(e) => handleKeyDown(e, loc.id)}
                  aria-label={`View details for ${loc.name}`}
                  aria-expanded={isActive}
                >
                  <div
                    className={`p-2 rounded-full shadow-lg transition-colors ${
                      isActive
                        ? "bg-pink-600"
                        : "bg-white hover:bg-pink-50"
                    }`}
                  >
                    <MapPin
                      className={`w-6 h-6 ${
                        isActive ? "text-white" : "text-pink-500"
                      }`}
                    />
                  </div>
                </button>
              );
            })}

            {userLocation && mapContainerRef.current && (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                style={{
                  left: `${projectToPixel(
                    userLocation.lat,
                    userLocation.lng,
                    mapBounds,
                    containerSize.width,
                    containerSize.height
                  ).x}px`,
                  top: `${projectToPixel(
                    userLocation.lat,
                    userLocation.lng,
                    mapBounds,
                    containerSize.width,
                    containerSize.height
                  ).y}px`,
                }}
                aria-label="Your current location"
              >
                <div className="relative">
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
                  <div className="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-50" />
                </div>
              </div>
            )}

            {mapState === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 z-5">
                <div className="text-center p-6">
                  <MapPin className="w-12 h-12 text-pink-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    {locationsWithCoords.length > 0
                      ? `${locationsWithCoords.length} clinic location${
                          locationsWithCoords.length > 1 ? "s" : ""
                        } available`
                      : "No mapped locations"}
                  </p>
                  {geolocationSupported && !userLocation && (
                    <button
                      onClick={requestLocation}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <Crosshair className="w-4 h-4 inline mr-1" />
                      Enable Location
                    </button>
                  )}
                </div>
              </div>
            )}

            {mapState === "loaded" && (
              <div className="absolute bottom-4 left-4 right-4 z-30">
                <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-blue-900 uppercase tracking-widest">
                      {activeLocation
                        ? allLocations.find((l) => l.id === activeLocation)
                            ?.name || "Clinic"
                        : "All Locations"}
                    </span>
                    {userLocation && (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <Crosshair className="w-3 h-3" />
                        Your location
                      </span>
                    )}
                  </div>
                  {activeLocation ? (
                    (() => {
                      const loc = allLocations.find(
                        (l) => l.id === activeLocation
                      );
                      if (!loc) return null;
                      return (
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {loc.address}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {loc.city}
                          </p>
                          {loc.coordinates && userLocation && (
                            <p className="text-xs text-blue-600 mt-1 font-medium">
                              {formatDistance(
                                calculateDistance(
                                  userLocation.lat,
                                  userLocation.lng,
                                  loc.coordinates.lat,
                                  loc.coordinates.lng
                                )
                              )}{" "}
                              away
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-gray-600">
                      Click a marker or select a clinic below to view details.
                    </p>
                  )}
                  {!userLocation && geolocationSupported && (
                    <button
                      onClick={requestLocation}
                      className="mt-2 w-full px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-1"
                    >
                      <Crosshair className="w-3 h-3" />
                      Find My Location
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details List */}
      <div
        className="space-y-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-blue-200"
        role="region"
        aria-label="Clinic location details"
      >
        {sortedLocations.map((loc) => {
          const isExpanded = expandedLocation === loc.id;
          const isActive = activeLocation === loc.id;
          const distance =
            userLocation && loc.coordinates
              ? calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  loc.coordinates.lat,
                  loc.coordinates.lng
                )
              : null;

          return (
            <div
              key={loc.id}
              className={`p-6 bg-white rounded-3xl border shadow-sm transition-all relative group overflow-hidden ${
                isActive
                  ? "border-pink-300 shadow-md"
                  : "border-gray-100 hover:border-pink-200"
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-full -mr-12 -mt-12 group-hover:bg-pink-100 transition-colors" />

              <div className="relative">
                <button
                  type="button"
                  className="w-full text-left flex items-start justify-between gap-2"
                  onClick={() => handleLocationClick(loc.id)}
                  onKeyDown={(e) => handleKeyDown(e, loc.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`location-details-${loc.id}`}
                >
                  <div className="flex-1">
                    <h4 className="font-black text-blue-900 text-lg mb-1">
                      {loc.name}
                    </h4>
                    {distance !== null && (
                      <p className="text-xs text-blue-600 font-semibold mb-2">
                        {formatDistance(distance)} away
                      </p>
                    )}
                  </div>
                  <span className="text-gray-400 mt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </span>
                </button>

                <div className="space-y-3 mt-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-600 font-medium">
                      {loc.address}
                      <br />
                      {loc.city}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                    <a
                      href={getCallUrl(loc.phone)}
                      className="text-sm text-gray-600 font-bold hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      aria-label={`Call ${loc.name} at ${loc.phone}`}
                    >
                      {loc.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                    <a
                      href={`mailto:${loc.email}`}
                      className="text-sm text-gray-600 font-medium hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      aria-label={`Email ${loc.name} at ${loc.email}`}
                    >
                      {loc.email}
                    </a>
                  </div>
                </div>

                <div
                  id={`location-details-${loc.id}`}
                  className={`mt-4 space-y-2 ${
                    isExpanded ? "block" : "hidden"
                  }`}
                  role="region"
                  aria-label={`Additional details for ${loc.name}`}
                >
                  {loc.coordinates && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                      <span className="font-semibold">Coordinates:</span>{" "}
                      {loc.coordinates.lat.toFixed(4)},{" "}
                      {loc.coordinates.lng.toFixed(4)}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={getNavigateUrl(loc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label={`Navigate to ${loc.name}`}
                    >
                      <Navigation className="w-3.5 h-3.5" /> Navigate
                    </a>
                    <a
                      href={getCallUrl(loc.phone)}
                      className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      aria-label={`Call ${loc.name}`}
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Clinic
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {locationsWithoutCoords.length > 0 && locationsWithCoords.length > 0 && (
          <div className="text-center py-2">
            <p className="text-xs text-gray-400 font-medium">
              {locationsWithoutCoords.length} location
              {locationsWithoutCoords.length > 1 ? "s" : ""} without map
              coordinates
            </p>
          </div>
        )}

        {allLocations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">
              No clinic locations available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
