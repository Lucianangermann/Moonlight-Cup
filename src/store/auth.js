import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api.getSession()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecked(true));
  }, []);

  const login = async (username, password) => {
    const r = await api.login(username, password); // throws ApiError on 401
    setIsAdmin(r.isAdmin);
  };

  const logout = async () => {
    await api.logout();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, checked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
