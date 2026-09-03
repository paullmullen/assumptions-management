import { createContext, useContext, useId, useLayoutEffect } from "react";

export const DraftContext = createContext(null);
export function useNavigationGuard() {
  const context = useContext(DraftContext);
  return context?.request ?? ((action) => action());
}
export function useDraft(label, descriptor) {
  const context = useContext(DraftContext);
  const id = useId();
  useLayoutEffect(() => {
    context?.register(id, { label, ...descriptor });
  });
  useLayoutEffect(() => () => context?.unregister(id), [context, id]);
}
