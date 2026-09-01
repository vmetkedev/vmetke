import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import {
  fetchUserProfile,
  fetchUserPosts,
  followUser,
  unfollowUser,
  type UserProfile,
} from "../lib/users";
import type { Post } from "../lib/posts";
import { PostCard } from "../components/PostCard";
import { AppLayout } from "../components/AppLayout";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const [profileData, postsData] = await Promise.all([
        fetchUserProfile(username),
        fetchUserPosts(username),
      ]);
      setProfile(profileData);
      setPosts(postsData.posts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (profile.isFollowedByMe) {
        await unfollowUser(profile.id);
      } else {
        await followUser(profile.id);
      }
      setProfile({
        ...profile,
        isFollowedByMe: !profile.isFollowedByMe,
        followersCount: profile.followersCount + (profile.isFollowedByMe ? -1 : 1),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <AppLayout><p className="p-8 text-center text-gray-500 dark:text-gray-400">Загрузка...</p></AppLayout>;
  if (error || !profile)
    return <AppLayout><p className="p-8 text-center text-red-600">{error || "Пользователь не найден"}</p></AppLayout>;
  
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-semibold dark:text-gray-100">{profile.displayName || profile.username}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">@{profile.username}</p>
            </div>
            {!profile.isMe && (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`text-sm rounded px-4 py-1.5 disabled:opacity-50 ${
                profile.isFollowedByMe
                  ? "border dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  : "bg-blue-600 text-white"
              }`}
            >
                {profile.isFollowedByMe ? "Отписаться" : "Подписаться"}
              </button>
            )}
          </div>
          <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mt-3">
            <span>{profile.followersCount} подписчиков</span>
            <span>{profile.followingCount} подписок</span>
          </div>
        </div>

        {posts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">Постов пока нет.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}