import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { JobPortalLanding } from './pages/JobPortalLanding';
import { AdminDashboard } from './pages/AdminDashboard';

export function App() {
  const [route, setRoute] = useState(() => {
    return window.location.pathname.startsWith('/admin') ? '/admin' : '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? '/admin' : '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AuthProvider>
      {route === '/admin' ? (
        <AdminDashboard onNavigateVisitor={() => navigateTo('/')} />
      ) : (
        <JobPortalLanding onNavigateAdmin={() => navigateTo('/admin')} />
      )}
    </AuthProvider>
  );
}

export default App;
