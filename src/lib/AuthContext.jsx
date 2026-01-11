import React, { createContext, useState, useContext, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  useEffect(() => {
    // Check if user was previously logged in (check localStorage)
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const storedUser = localStorage.getItem('google_user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    }
  };

  const login = async () => {
    try {
      setIsLoadingAuth(true);
      
      if (!Capacitor.isNativePlatform()) {
        alert('Google login is only available on iOS/Android. Please use the mobile app.');
        setIsLoadingAuth(false);
        return;
      }

      // Initialize Google Auth (configuration is in capacitor.config.ts)
      await GoogleAuth.initialize();

      // Sign in with Google
      const result = await GoogleAuth.signIn();
      
      if (result) {
        const userData = {
          id: result.id,
          email: result.email,
          name: result.name,
          imageUrl: result.imageUrl,
          accessToken: result.accessToken
        };
        
        // Store user data
        localStorage.setItem('google_user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Google login error:', error);
      alert('Failed to login with Google. Please try again.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleAuth.signOut();
      }
      
      // Clear stored user data
      localStorage.removeItem('google_user');
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if sign out fails
      localStorage.removeItem('google_user');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
