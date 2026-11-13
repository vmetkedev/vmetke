import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { FeedPage } from "@/pages/feed";
import { ProtectedRoute } from "@/entities/session";
import { AdminGuard } from "@/entities/session";

const ProfilePage = lazy(() => import("@/pages/profile").then((m) => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() => import("@/pages/notifications").then((m) => ({ default: m.NotificationsPage })));
const PostPage = lazy(() => import("@/pages/post").then((m) => ({ default: m.PostPage })));
const NewPostPage = lazy(() => import("@/pages/new-post").then((m) => ({ default: m.NewPostPage })));
const BookmarksPage = lazy(() => import("@/pages/bookmarks").then((m) => ({ default: m.BookmarksPage })));
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })));
const SearchPage = lazy(() => import("@/pages/search").then((m) => ({ default: m.SearchPage })));
const MessagesPage = lazy(() => import("@/pages/messages").then((m) => ({ default: m.MessagesPage })));
const MarkdownHelpPage = lazy(() => import("@/pages/help").then((m) => ({ default: m.MarkdownHelpPage })));
const WysiwygHelpPage = lazy(() => import("@/pages/help").then((m) => ({ default: m.WysiwygHelpPage })));
const AdminRoutes = lazy(() => import("@/pages/admin").then((m) => ({ default: m.AdminRoutes })));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400">
      Загрузка…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<FeedPage />} />
        <Route path="/post/:postId" element={<PostPage />} />
        <Route path="/u/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/new-post" element={<ProtectedRoute><NewPostPage /></ProtectedRoute>} />
        <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/docs/help/markdown" element={<MarkdownHelpPage />} />
        <Route path="/docs/help/wysiwyg" element={<WysiwygHelpPage />} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/:id" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}