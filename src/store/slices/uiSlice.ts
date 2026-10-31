import { createSlice } from "@reduxjs/toolkit";

export interface UiState {
  /** Desktop: icon-only sidebar. */
  sidebarCollapsed: boolean;
  /** Mobile/tablet: off-canvas drawer visibility. */
  mobileSidebarOpen: boolean;
}

const initialState: UiState = { sidebarCollapsed: false, mobileSidebarOpen: false };

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    expandSidebar: (state) => {
      state.sidebarCollapsed = false;
    },
    openMobileSidebar: (state) => {
      state.mobileSidebarOpen = true;
    },
    closeMobileSidebar: (state) => {
      state.mobileSidebarOpen = false;
    },
  },
  selectors: {
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    selectMobileSidebarOpen: (state) => state.mobileSidebarOpen,
  },
});

export const { toggleSidebarCollapsed, expandSidebar, openMobileSidebar, closeMobileSidebar } = uiSlice.actions;
export const { selectSidebarCollapsed, selectMobileSidebarOpen } = uiSlice.selectors;
export default uiSlice;
