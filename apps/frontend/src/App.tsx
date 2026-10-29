import { Routes, Route } from "react-router";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FeedPage from "./pages/FeedPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import PostPage from "./pages/PostPage";
import NewPostPage from "./pages/NewPostPage";
import BookmarksPage from "./pages/BookmarksPage";
import SettingsPage from "./pages/SettingsPage";
import MarkdownHelpPage from "./pages/help/MarkdownHelpPage";
import WysiwygHelpPage from "./pages/help/WysiwygHelpPage";
import ProtectedRoute from "./auth/ProtectedRoute";
import SearchPage from "./pages/SearchPage";
import MessagesPage from "./pages/MessagesPage";
import { AdminGuard } from "./components/AdminGuard";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminGuard />}>
        <Route index element={<div className="max-w-4xl mx-auto p-6">Админка (в разработке)</div>} />
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
  );
}