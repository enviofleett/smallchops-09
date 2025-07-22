
declare module 'maplibre-gl-draw' {
  import { Map } from '@maptiler/sdk';
  import { FeatureCollection } from 'geojson';

  // Minimal IControl interface to satisfy MaplibreDraw
  interface IControl {
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    getDefaultPosition?(): string;
  }

  class MapLibreDraw implements IControl {
    constructor(options?: {
      displayControlsDefault?: boolean;
      controls?: {
        polygon?: boolean;
        trash?: boolean;
        [key: string]: boolean | undefined;
      };
      defaultMode?: string;
    });

    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
    
    set(data: FeatureCollection): string[];
    getAll(): FeatureCollection;
    deleteAll(): this;
  }

  export default MapLibreDraw;
}
