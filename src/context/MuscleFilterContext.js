import React, { createContext, useContext, useState } from 'react';

const MuscleFilterContext = createContext({
  muscleFilter: null,        // { cat: 'Göğüs', label: 'Chest', muscle: 'Pectoralis Major' }
  setMuscleFilter: () => {},
  clearMuscleFilter: () => {},
});

export function MuscleFilterProvider({ children }) {
  const [muscleFilter, setMuscleFilter] = useState(null);
  const clearMuscleFilter = () => setMuscleFilter(null);
  return (
    <MuscleFilterContext.Provider value={{ muscleFilter, setMuscleFilter, clearMuscleFilter }}>
      {children}
    </MuscleFilterContext.Provider>
  );
}

export const useMuscleFilter = () => useContext(MuscleFilterContext);
