"use client";

import { createContext, useContext } from "react";

/**
 * Guest mode: true when the viewer may only look. Add/edit/delete icons disappear and
 * ticks, toggles and drag handles are disabled. (Trip changes are also blocked in TripPlanner
 * and rejected by the server, so this is about not offering the controls.)
 */
const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ReadOnlyContext.Provider;

export const useReadOnly = () => useContext(ReadOnlyContext);
