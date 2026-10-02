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
import { Avatar } from "../components/Avatar";

type Tab = "profile" | "posts";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Профиль" },
  { id: "posts", label: "Посты" },
];

const CARD = "bg-white dark:bg-gray-800 rounded-lg shadow";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

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
    setTab("profile");
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
      <div className="max-w-5xl mx-auto p-4 sm:p-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        {/* Левая колонка */}
        <div className="space-y-4 min-w-0">
          {/* Шапка профиля */}
          <div className={CARD}>
            <div className="p-5 pb-4">
              <div className="flex items-start gap-4">
                <Avatar
                  username={profile.username}
                  displayName={profile.displayName}
                  avatarColor={profile.avatarColor}
                  size="lg"
                />
                <div className="text-center min-w-[72px]">
                  <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                    {profile.followersCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Подписчики</div>
                </div>
                <div className="text-center min-w-[72px]">
                  <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                    {profile.followingCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Подписки</div>
                </div>
                {!profile.isMe && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`ml-auto text-sm rounded px-4 py-1.5 disabled:opacity-50 ${
                      profile.isFollowedByMe
                        ? "border dark:border-gray-600 text-gray-700 dark:text-gray-200"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {profile.isFollowedByMe ? "Отписаться" : "Подписаться"}
                  </button>
                )}
              </div>
              <h1 className="mt-3 text-xl font-semibold text-blue-600 dark:text-blue-400 break-all">
                @{profile.username}
              </h1>
              {profile.displayName && (
                <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{profile.displayName}</p>
              )}
            </div>

            <div className="flex gap-6 px-5 border-t dark:border-gray-700">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-3 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px ${
                    tab === t.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Контент таба */}
          {tab === "profile" ? (
            <div className={`${CARD} p-5`}>
              <h2 className="text-sm font-semibold dark:text-gray-100 mb-2">О себе</h2>
              {profile.bio ? (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap wrap-break-word">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Пользователь пока ничего не рассказал о себе.
                </p>
              )}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Постов пока нет.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка */}
        <aside className={`${CARD} p-5`}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-3 border-b dark:border-gray-700">
            Информация
          </h2>
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-4 text-sm">
            <dt className="font-semibold dark:text-gray-100">Зарегистрирован</dt>
            <dd className="text-gray-700 dark:text-gray-300">{formatDate(profile.createdAt)}</dd>
          </dl>
        </aside>
      </div>
    </AppLayout>
  );
}