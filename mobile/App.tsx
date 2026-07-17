import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { NewTaskScreen } from './src/screens/NewTaskScreen';
import { NowScreen } from './src/screens/NowScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { TaskDetailScreen } from './src/screens/TaskDetailScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabDot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
      }}
    >
      <Tabs.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="Now"
        component={NowScreen}
        options={{ tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="Plan"
        component={PlanScreen}
        options={{ tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
      <Tabs.Screen
        name="New"
        component={NewTaskScreen}
        options={{ tabBarIcon: ({ color }) => <TabDot color={color} /> }}
      />
    </Tabs.Navigator>
  );
}

function SignOutButton() {
  const logout = useAuthStore((s) => s.logout);
  return (
    <Pressable onPress={logout} hitSlop={8}>
      <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>Sign out</Text>
    </Pressable>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function Router() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return <Splash />;

  return (
    <NavigationContainer>
      {token ? (
        <RootStack.Navigator>
          <RootStack.Screen
            name="Tabs"
            component={TabsNavigator}
            options={{ title: 'Momentum', headerRight: () => <SignOutButton /> }}
          />
          <RootStack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{ title: 'Task' }}
          />
        </RootStack.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Router />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
