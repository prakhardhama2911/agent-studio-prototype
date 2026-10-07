import { createContext, useContext } from "react";
export const EditModeContext = createContext(true);
export const useEditMode = () => useContext(EditModeContext);
