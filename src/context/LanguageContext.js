import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LanguageContext = createContext({ lang: 'tr', setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('tr');

  useEffect(() => {
    AsyncStorage.getItem('fitopia_lang').then(v => { if (v) setLangState(v); });
  }, []);

  const setLang = async (l) => {
    setLangState(l);
    await AsyncStorage.setItem('fitopia_lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
