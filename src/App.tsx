import { LoadingBall } from '@/components/motion/LoadingBall'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { AuthProvider } from '@/contexts/AuthContext'
import { PwaInstallProvider } from '@/contexts/PwaInstallContext'
import { LocationProvider } from '@/contexts/LocationContext'
import { AppLayout } from '@/layouts/AppLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy } from 'react'

const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const AuthPage = lazy(() =>
  import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })),
)
const WelcomePage = lazy(() =>
  import('@/pages/WelcomePage').then((m) => ({ default: m.WelcomePage })),
)
const HomePage = lazy(() =>
  import('@/pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const ExplorePage = lazy(() =>
  import('@/pages/ExplorePage').then((m) => ({ default: m.ExplorePage })),
)
const HostPage = lazy(() =>
  import('@/pages/HostPage').then((m) => ({ default: m.HostPage })),
)
const MyGamesPage = lazy(() =>
  import('@/pages/MyGamesPage').then((m) => ({ default: m.MyGamesPage })),
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const GameDetailsPage = lazy(() =>
  import('@/pages/GameDetailsPage').then((m) => ({
    default: m.GameDetailsPage,
  })),
)
const JoinGamePage = lazy(() =>
  import('@/pages/JoinGamePage').then((m) => ({ default: m.JoinGamePage })),
)
const VenueSelectPage = lazy(() =>
  import('@/pages/VenueSelectPage').then((m) => ({
    default: m.VenueSelectPage,
  })),
)
const AddVenuePage = lazy(() =>
  import('@/pages/AddVenuePage').then((m) => ({ default: m.AddVenuePage })),
)
const VenueDetailsPage = lazy(() =>
  import('@/pages/VenueDetailsPage').then((m) => ({
    default: m.VenueDetailsPage,
  })),
)
const GroupsPage = lazy(() =>
  import('@/pages/GroupsPage').then((m) => ({ default: m.GroupsPage })),
)
const CreateGroupPage = lazy(() =>
  import('@/pages/CreateGroupPage').then((m) => ({
    default: m.CreateGroupPage,
  })),
)
const GroupDetailsPage = lazy(() =>
  import('@/pages/GroupDetailsPage').then((m) => ({
    default: m.GroupDetailsPage,
  })),
)
const JoinGameInvitePage = lazy(() =>
  import('@/pages/JoinInvitePages').then((m) => ({
    default: m.JoinGameInvitePage,
  })),
)
const JoinGroupInvitePage = lazy(() =>
  import('@/pages/JoinInvitePages').then((m) => ({
    default: m.JoinGroupInvitePage,
  })),
)

function RouteFallback() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-surface"
      role="status"
      aria-live="polite"
    >
      <LoadingBall size="lg" />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <PwaInstallProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/welcome" element={<WelcomePage />} />
                  <Route
                    path="/join/game/:token"
                    element={<JoinGameInvitePage />}
                  />
                  <Route
                    path="/join/group/:token"
                    element={<JoinGroupInvitePage />}
                  />
                </Route>

                <Route element={<AppLayout />}>
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/explore" element={<ExplorePage />} />
                  <Route path="/host" element={<HostPage />} />
                  <Route path="/my-games" element={<MyGamesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/games/:id" element={<GameDetailsPage />} />
                  <Route path="/games/:id/join" element={<JoinGamePage />} />
                  <Route path="/venues" element={<VenueSelectPage />} />
                  <Route path="/venues/new" element={<AddVenuePage />} />
                  <Route path="/venues/:id" element={<VenueDetailsPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/groups/new" element={<CreateGroupPage />} />
                  <Route path="/groups/:id" element={<GroupDetailsPage />} />
                  <Route path="/game/:id" element={<GameDetailsPage />} />
                  <Route path="/group/:id" element={<GroupDetailsPage />} />
                  <Route path="/venue/:id" element={<VenueDetailsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <InstallPrompt />
          </BrowserRouter>
        </PwaInstallProvider>
      </LocationProvider>
    </AuthProvider>
  )
}
