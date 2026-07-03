import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UnitsContext = createContext({
  weightUnit: 'kg',
  lengthUnit: 'cm',
  setWeightUnit: () => {},
  setLengthUnit: () => {},
});

export function UnitsProvider({ children }) {
  const [weightUnit, setWU] = useState('kg');
  const [lengthUnit, setLU] = useState('cm');

  useEffect(() => {
    AsyncStorage.getItem('fitopia_weight_unit').then(v => { if (v) setWU(v); });
    AsyncStorage.getItem('fitopia_length_unit').then(v => { if (v) setLU(v); });
  }, []);

  const setWeightUnit = async (u) => { setWU(u); await AsyncStorage.setItem('fitopia_weight_unit', u); };
  const setLengthUnit = async (u) => { setLU(u); await AsyncStorage.setItem('fitopia_length_unit', u); };

  return (
    <UnitsContext.Provider value={{ weightUnit, lengthUnit, setWeightUnit, setLengthUnit }}>
      {children}
    </UnitsContext.Provider>
  );
}

export const useUnits = () => useContext(UnitsContext);

export function fmtWeight(kg, unit) {
  if (!kg && kg !== 0) return '—';
  if (unit === 'lb') return `${(kg * 2.20462).toFixed(1)} lb`;
  return `${kg} kg`;
}

// cm → feet+inches, ör. 180cm → 5'11"
export function cmToFeetInches(cm) {
  const totalIn = Math.round(cm / 2.54);
  let ft = Math.floor(totalIn / 12);
  let inch = totalIn - ft * 12;
  if (inch === 12) { ft += 1; inch = 0; }
  return { ft, inch };
}

export function fmtHeight(cm, unit) {
  if (!cm && cm !== 0) return '—';
  if (unit === 'ft' || unit === 'in') {
    const { ft, inch } = cmToFeetInches(cm);
    return `${ft}'${inch}"`;
  }
  return `${cm} cm`;
}
