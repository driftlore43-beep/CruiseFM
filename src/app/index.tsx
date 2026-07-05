import { Redirect } from 'expo-router';

// The real Cruise home screen lives at (tabs)/cruise.tsx.
// This redirect ensures the root path "/" goes there.
export default function Index() {
  return <Redirect href="/cruise" />;
}
