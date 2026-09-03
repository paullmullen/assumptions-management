import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigationGuard } from "./draftContext.js";

export default function useProjectNavigation() {
  const request = useNavigationGuard();
  const [pathname, setPathname] = useState(window.location.pathname);
  const accepted = useRef({
    index: window.history.state?.workspaceIndex ?? 0,
    path: window.location.pathname,
  });
  const restoring = useRef(null);
  const allowed = useRef(false);
  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, workspaceIndex: accepted.current.index },
      "",
    );
    function onPop() {
      const index = window.history.state?.workspaceIndex;
      if (restoring.current) {
        const target = restoring.current;
        restoring.current = null;
        request(() => {
          allowed.current = true;
          window.history.go(target.index - accepted.current.index);
        });
        return;
      }
      if (allowed.current || index === accepted.current.index) {
        allowed.current = false;
        accepted.current = { index, path: window.location.pathname };
        setPathname(window.location.pathname);
        return;
      }
      if (Number.isInteger(index)) {
        restoring.current = { index };
        window.history.go(accepted.current.index - index);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [request]);
  const navigate = useCallback(
    (path) => {
      if (path === accepted.current.path) return;
      request(() => {
        const index = accepted.current.index + 1;
        window.history.pushState({ workspaceIndex: index }, "", path);
        accepted.current = { index, path };
        setPathname(path);
      });
    },
    [request],
  );
  return [pathname, navigate];
}
