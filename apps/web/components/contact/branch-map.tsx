"use client";

import { useEffect } from "react";
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import type { BranchDetail } from "@/lib/branch-detail";

type BranchMapProps = {
  apiKey: string;
  branches: BranchDetail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  // Called when Google refuses to load or rejects the key, so the page can fall back to the list.
  onFail: () => void;
};

// Turkey as a whole until there is something to fit.
const TURKEY = { lat: 39, lng: 35 };

// Keeps the view on what the list shows: all matches, or a close-up of the selected branch.
function Viewport({ branches, selectedId }: Pick<BranchMapProps, "branches" | "selectedId">) {
  const map = useMap();

  useEffect(() => {
    if (!map || branches.length === 0) return;
    const selected = branches.find((branch) => branch.id === selectedId);
    if (selected) {
      map.panTo({ lat: selected.latitude, lng: selected.longitude });
      map.setZoom(13);
      return;
    }
    if (branches.length === 1) {
      map.panTo({ lat: branches[0].latitude, lng: branches[0].longitude });
      map.setZoom(11);
      return;
    }
    const lats = branches.map((branch) => branch.latitude);
    const lngs = branches.map((branch) => branch.longitude);
    map.fitBounds(
      { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) },
      48,
    );
  }, [map, branches, selectedId]);

  return null;
}

// Loaded only by the contact page (ARCHITECTURE ADR-09), so no other page pays for it.
export function BranchMap({ apiKey, branches, selectedId, onSelect, onFail }: BranchMapProps) {
  // Google reports a rejected key (wrong referrer, billing off) through this global, not
  // through the loader's error callback.
  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => onFail();
    return () => {
      window.gm_authFailure = previous;
    };
  }, [onFail]);

  return (
    <APIProvider apiKey={apiKey} onError={onFail}>
      <Map
        // A map id is required for advanced markers; Google's demo id is enough until the
        // project has its own styled map.
        mapId="DEMO_MAP_ID"
        defaultCenter={TURKEY}
        defaultZoom={5}
        gestureHandling="cooperative"
        className="size-full"
      >
        {branches.map((branch) => (
          <AdvancedMarker
            key={branch.id}
            position={{ lat: branch.latitude, lng: branch.longitude }}
            title={`${branch.city} · ${branch.name}`}
            onClick={() => onSelect(branch.id)}
          >
            <Pin scale={branch.id === selectedId ? 1.3 : 1} />
          </AdvancedMarker>
        ))}
      </Map>
      <Viewport branches={branches} selectedId={selectedId} />
    </APIProvider>
  );
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}
