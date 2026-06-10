import { useEffect, useState } from "react";
import { getCurrentWindow } from "../../services/vscodeBridge";

export function useWindowLabel(defaultLabel = "main") {
  const [label, setLabel] = useState(defaultLabel);

  useEffect(() => {
    try {
      const window = getCurrentWindow();
      setLabel(window.label ?? defaultLabel);
    } catch {
      setLabel(defaultLabel);
    }
  }, [defaultLabel]);

  return label;
}
