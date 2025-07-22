import React, { useRef, useEffect } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import MapLibreDraw from 'maplibre-gl-draw';
import '@maptiler/sdk/dist/maptiler-sdk.css';
// import 'maplibre-gl-draw/dist/maplibre-gl-draw.css'; // Temporarily commented out to fix build issue.
import { FeatureCollection } from 'geojson';
import { useMapApiKey } from '@/hooks/useMapApiKey';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
    initialArea: FeatureCollection | null;
    onAreaChange: (area: FeatureCollection) => void;
};

const DeliveryZoneMap = ({ initialArea, onAreaChange }: Props) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maptilersdk.Map | null>(null);
    const drawRef = useRef<MapLibreDraw | null>(null);
    
    const { data: apiKey, isLoading, error } = useMapApiKey();

    useEffect(() => {
        if (!apiKey || mapRef.current || !mapContainer.current) return;

        maptilersdk.config.apiKey = apiKey;
        const map = new maptilersdk.Map({
            container: mapContainer.current,
            style: maptilersdk.MapStyle.STREETS,
            center: [3.3792, 6.5244], // Lagos
            zoom: 10,
        });
        mapRef.current = map;

        const draw = new MapLibreDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true
            },
            defaultMode: 'draw_polygon'
        });
        drawRef.current = draw;
        map.addControl(draw);

        const updateArea = () => {
            if (!drawRef.current) return;
            const data = drawRef.current.getAll();
            onAreaChange(data);
        };

        map.on('draw.create', updateArea);
        map.on('draw.delete', updateArea);
        map.on('draw.update', updateArea);

        map.on('load', () => {
             if (drawRef.current && initialArea) {
                drawRef.current.set(initialArea);
            }
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [apiKey, onAreaChange]);

    useEffect(() => {
        if (drawRef.current) {
            if (initialArea) {
                const currentFeatures = JSON.stringify(drawRef.current.getAll());
                const newFeatures = JSON.stringify(initialArea);
                if (currentFeatures !== newFeatures) {
                    drawRef.current.set(initialArea);
                }
            } else {
                drawRef.current.deleteAll();
            }
        }
    }, [initialArea]);

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

    return <div ref={mapContainer} className="w-full h-full rounded-lg bg-gray-200" />;
};

export default DeliveryZoneMap;
