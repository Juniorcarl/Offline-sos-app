import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { UserProvider, useUser } from './context/UserContext';
import BottomTabs from './navigation/BottomTabs';

function RootNavigator() {
  const { role } = useUser();

  return (
    <NavigationContainer key={role}>
      <BottomTabs />
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