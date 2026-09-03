import { Routes, Route } from "react-router";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FeedPage from "./pages/FeedPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import PostPage from "./pages/PostPage";
import NewPostPage from "./pages/NewPostPage";
import BookmarksPage from "./pages/BookmarksPage";
import ProtectedRoute from "./auth/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<FeedPage />} />
      <Route path="/post/:postId" element={<PostPage />} />
      <Route path="/u/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/new-post" element={<ProtectedRoute><NewPostPage /></ProtectedRoute>} />
      <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
    </Routes>
  );
}