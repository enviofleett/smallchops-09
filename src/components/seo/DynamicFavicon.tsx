import React from "react";
import { Helmet } from "react-helmet-async";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

// Utility to create a square favicon from an image URL at the requested size
async function createIconDataUrl(src: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src); // fallback to raw src

        canvas.width = size;
        canvas.height = size;

        // Transparent background for versatility
        ctx.clearRect(0, 0, size, size);

        // Add safe padding so logo isn't cramped at tiny sizes
        const padding = Math.round(size * 0.12);
        const drawW = size - padding * 2;
        const drawH = size - padding * 2;

        // Maintain aspect ratio within padded square
        const imgRatio = img.naturalWidth / img.naturalHeight;
        let w = drawW;
        let h = Math.round(drawW / imgRatio);
        if (h > drawH) {
          h = drawH;
          w = Math.round(drawH * imgRatio);
        }
        const x = Math.round((size - w) / 2);
        const y = Math.round((size - h) / 2);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, x, y, w, h);

        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

const DynamicFavicon: React.FC = () => {
  const { data: settings } = useBusinessSettings();

  const [icons, setIcons] = React.useState({
    f16: "",
    f32: "",
    apple: "",
  });

  React.useEffect(() => {
    const logoSrc = settings?.favicon_url || settings?.logo_dark_url || settings?.logo_url;
    if (!logoSrc) return;

    let mounted = true;
    (async () => {
      try {
        const [f32, f16, apple] = await Promise.all([
          createIconDataUrl(logoSrc, 32),
          createIconDataUrl(logoSrc, 16),
          createIconDataUrl(logoSrc, 180),
        ]);
        if (mounted) setIcons({ f16, f32, apple });
      } catch {
        // swallow – helmet will not render if empty
      }
    })();

    return () => {
      mounted = false;
    };
  }, [settings?.favicon_url, settings?.logo_dark_url, settings?.logo_url]);

  // If we don't have processed icons yet, render nothing – static fallbacks will apply
  if (!icons.f16 && !icons.f32 && !icons.apple) return null;

  return (
    <Helmet>
      {icons.f32 && (
        <link rel="icon" type="image/png" sizes="32x32" href={icons.f32} />
      )}
      {icons.f16 && (
        <link rel="icon" type="image/png" sizes="16x16" href={icons.f16} />
      )}
      {icons.apple && (
        <link rel="apple-touch-icon" sizes="180x180" href={icons.apple} />
      )}
    </Helmet>
  );
};

export default DynamicFavicon;
