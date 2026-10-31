"use client";

import { useEffect } from "react";
import { AdvancedMarker, APIProvider, Map, Pin, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { RouteDay, TrackedVehicle } from "@/lib/tracking";

type TrackingMapProps = {
  apiKey: string;
  // Only the cars that have a place; the number on a pin is its place in the list.
  pins: Array<{ number: number; vehicle: TrackedVehicle }>;
  selectedPlate: string | null;
  route: RouteDay | null;
  onSelect: (plate: string) => void;
  // Called when Google refuses to load or rejects the key, so the screen can say so and go on with the list.
  onFail: () => void;
};

const TURKEY = { lat: 39, lng: 35 };

// Keeps the view on what is drawn: the route of the chosen car if it has one, the chosen car, else every pin.
function Viewport({ pins, selectedPlate, route }: Pick<TrackingMapProps, "pins" | "selectedPlate" | "route">) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  // The route is drawn as a line; a line is not a component of the library, so it is made here and taken away when it changes.
  useEffect(() => {
    if (!map || !maps || !route || route.points.length < 2) return;
    // The colour is the site's own token, read from the page, so the line follows the brand and the theme (DESIGN.md) and no colour is written here.
    const color = getComputedStyle(document.documentElement).getPropertyValue("--novera-primary").trim() || getComputedStyle(document.body).color;
    const line = new maps.Polyline({
      map,
      path: route.points.map((point) => ({ lat: point.latitude, lng: point.longitude })),
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    return () => line.setMap(null);
  }, [map, maps, route]);

  useEffect(() => {
    if (!map) return;
    const places = route && route.points.length > 0 ? route.points.map((point) => ({ lat: point.latitude, lng: point.longitude })) : pins.filter((pin) => selectedPlate === null || pin.vehicle.plate === selectedPlate).map((pin) => ({ lat: pin.vehicle.position!.latitude, lng: pin.vehicle.position!.longitude }));
    if (places.length === 0) return;
    if (places.length === 1) {
      map.panTo(places[0]!);
      map.setZoom(14);
      return;
    }
    const lats = places.map((place) => place.lat);
    const lngs = places.map((place) => place.lng);
    map.fitBounds({ north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }, 48);
    // The pins move every thirty seconds; the view is moved only when the choice or the route changes, so it does not jump while somebody looks around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedPlate, route]);

  return null;
}

// Loaded only by the live tracking screen (docs/FLEET.md §3), so no other page pays for it.
export default function TrackingMap({ apiKey, pins, selectedPlate, route, onSelect, onFail }: TrackingMapProps) {
  // Google reports a rejected key (wrong referrer, billing off) through this global, not through the loader's error callback.
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => onFail();
    return () => {
      window.gm_authFailure = previous;
    };
  }, [onFail]);

  return (
    <APIProvider apiKey={apiKey} onError={onFail}>
      <Map mapId="DEMO_MAP_ID" defaultCenter={TURKEY} defaultZoom={5} gestureHandling="cooperative" className="size-full">
        {pins.map(({ number, vehicle }) => (
          <AdvancedMarker key={vehicle.plate} position={{ lat: vehicle.position!.latitude, lng: vehicle.position!.longitude }} title={`${number}. ${vehicle.plate}`} onClick={() => onSelect(vehicle.plate)}>
            <Pin scale={vehicle.plate === selectedPlate ? 1.3 : 1} glyph={String(number)} />
          </AdvancedMarker>
        ))}
      </Map>
      <Viewport pins={pins} selectedPlate={selectedPlate} route={route} />
    </APIProvider>
  );
}
