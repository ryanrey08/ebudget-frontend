import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./services/api";
import authSlice, { loggedOut } from "./slices/authSlice";
import uiSlice from "./slices/uiSlice";
import filtersSlice from "./slices/filtersSlice";
import alertsSlice from "./slices/alertsSlice";
import gaaWizardSlice from "@/features/appropriations/state/gaaWizardSlice";
import sabudbtrSlice from "@/features/bfars-reporting/sabudbtr/sabudbtrSlice";
import { apiErrorListener } from "./middleware/apiErrorListener";

const combinedReducer = combineSlices(api, authSlice, uiSlice, filtersSlice, alertsSlice, gaaWizardSlice, sabudbtrSlice);

/**
 * Ending the session (logout, 401, expired session) resets every
 * user-specific slice: auth, filters and in-progress wizards. UI layout and
 * pending toasts are kept; RTK Query's cache is cleared with
 * `api.util.resetApiState()` by useLogout.
 */
const rootReducer = (state: Parameters<typeof combinedReducer>[0], action: Parameters<typeof combinedReducer>[1]) => {
  if (state && loggedOut.match(action)) {
    const fresh = combinedReducer(undefined, action);
    return { ...fresh, [api.reducerPath]: state[api.reducerPath], ui: state.ui, alerts: state.alerts } as typeof fresh;
  }
  return combinedReducer(state, action);
};

/**
 * Store factory. A new store is created per request/browser session by
 * StoreProvider, so no state is ever shared between server requests.
 */
export function makeStore() {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(apiErrorListener.middleware).concat(api.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
