import { useEffect, useState } from "react";
export default function useWideWorkspace() {
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1440px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1440px)");
    const update = () => setWide(media.matches);
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return wide;
}
