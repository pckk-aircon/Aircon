"use client";

import { useEffect, useRef } from "react";

export default function Map5Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("maplibre iframe loaded");
    };

    iframe.addEventListener("load", handleLoad);

    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh", margin: 0 }}>
      <iframe
        ref={iframeRef}
        src="/maplibre-view/index.html?mode=embed"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </div>
  );
}


