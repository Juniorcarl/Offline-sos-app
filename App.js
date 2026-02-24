import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { UserProvider, useUser } from './context/UserContext';
import BottomTabs from './navigation/BottomTabs';
import AuthorityTabs from './navigation/AuthorityTabs';

function RootNavigator() {
  const { role } = useUser();

  return (
    <NavigationContainer key={role}>
      {role === 'Authority' ? <AuthorityTabs /> : <BottomTabs />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <RootNavigator />
    </UserProvider>
  );
}