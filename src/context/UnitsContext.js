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

export function fmtHeight(cm, unit) {
  if (!cm && cm !== 0) return '—';
  if (unit === 'in') return `${(cm * 0.393701).toFixed(1)} in`;
  return `${cm} cm`;
}
