import React, { useRef, useEffect } from "react";
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { useMapApiKey } from '@/hooks/useMapApiKey';
import { Skeleton } from '@/components/ui/skeleton';

export type Vehicle = {
  id: string;
  type: "bike" | "van";
  driver: string;
  location: { lng: number, lat: number };
  status: "online" | "delivering" | "available";
  eta?: string;
};

const VEHICLE_ICONS = {
  bike: "🚲",
  van: "🚐",
};

type Props = {
  vehicles: Vehicle[];
  selectedVehicleId?: string | null;
};

const DeliveryMap: React.FC<Props> = ({ vehicles, selectedVehicleId }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maptilersdk.Map | null>(null);
  const markersRef = useRef<maptilersdk.Marker[]>([]);
  
  const { data: apiKey, isLoading, error } = useMapApiKey();

  // Init map
  useEffect(() => {
    if (!apiKey || !mapContainer.current || mapRef.current) return;

    maptilersdk.config.apiKey = apiKey;
    mapRef.current = new maptilersdk.Map({
      container: mapContainer.current,
      style: maptilersdk.MapStyle.STREETS,
      center: [3.3792, 6.5244], // Centered on Lagos
      zoom: 11,
      attributionControl: false,
      pitch: 25,
    });

    mapRef.current.addControl(new maptilersdk.NavigationControl(), "top-right");
    mapRef.current.scrollZoom.disable();

    const currentMap = mapRef.current;
    return () => {
      currentMap?.remove();
      mapRef.current = null;
    };
  }, [apiKey]);

  // Place/update markers (+ highlight selected)
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    vehicles.forEach(vehicle => {
      const el = document.createElement("div");
      el.className = "vehicle-marker flex items-center justify-center";
      el.style.fontSize = "1.5rem";
      el.style.width = "2.25rem";
      el.style.height = "2.25rem";
      el.style.background = "#fff";
      el.style.borderRadius = "9999px";
      el.style.boxShadow = "0 2px 6px 0 rgba(0,0,0,.16)";

      // Visual highlight for selected
      if (vehicle.id === selectedVehicleId) {
        el.style.border = "3px solid #2563eb"; // blue-600
        el.style.boxShadow = "0 0 0 6px rgba(37,99,235,0.18)";
        el.style.zIndex = "10";
      } else {
        el.style.border =
          vehicle.status === "delivering"
            ? "2px solid #facc15"
            : vehicle.status === "online"
            ? "2px solid #22c55e"
            : "2px solid #64748b";
        el.style.zIndex = "1";
      }
      el.innerText = VEHICLE_ICONS[vehicle.type];

      const marker = new maptilersdk.Marker({element: el})
        .setLngLat(vehicle.location)
        .setPopup(
          new maptilersdk.Popup({ offset: 18 }).setHTML(`
            <div style="min-width:130px;">
                <b>${vehicle.driver}</b>
                <br/>
                Type: ${vehicle.type}
                <br/>
                Status: ${vehicle.status}
                <br/>
                ${vehicle.eta ? "ETA: " + vehicle.eta : ""}
            </div>
          `)
        )
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [vehicles, selectedVehicleId, apiKey]);

  // Center map on selected vehicle
  useEffect(() => {
    if (!mapRef.current || !selectedVehicleId) return;

    const selected = vehicles.find(v => v.id === selectedVehicleId);
    if (selected) {
      const { lng, lat } = selected.location;
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 13.5,
        speed: 1.35,
        curve: 1.6,
        essential: true,
      });
    }
  }, [selectedVehicleId, vehicles]);

  if (isLoading) {
    return <Skeleton className="w-full h-full bg-gray-200" />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 p-4 rounded-lg">
        <p className="text-red-600 text-center text-sm">
          <strong>Error loading map:</strong> {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
    </div>
  );
};

export default DeliveryMap;
