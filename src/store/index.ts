import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./services/api";
import authSlice from "./slices/authSlice";
import uiSlice from "./slices/uiSlice";
import filtersSlice from "./slices/filtersSlice";
import alertsSlice from "./slices/alertsSlice";
import gaaWizardSlice from "@/features/appropriations/state/gaaWizardSlice";
import { apiErrorListener } from "./middleware/apiErrorListener";

const rootReducer = combineSlices(api, authSlice, uiSlice, filtersSlice, alertsSlice, gaaWizardSlice);

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
