import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { fetchPost, type Post } from "../lib/posts";
import { fetchUserProfile, followUser, unfollowUser, type UserProfile } from "../lib/users";
import { PostCard } from "../components/PostCard";
import { PostComments } from "../components/PostComments";
import { AppLayout } from "../components/AppLayout";

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    fetchPost(postId)
      .then(async (p) => {
        setPost(p);
        const prof = await fetchUserProfile(p.author.username);
        setProfile(prof);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [postId]);

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
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <AppLayout><p className="p-8 text-center text-gray-500">Загрузка...</p></AppLayout>;
  if (error || !post)
    return <AppLayout><p className="p-8 text-center text-red-600">{error || "Пост не найден"}</p></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-4">
        <PostCard post={post} linkTitle={false} onDeleted={() => navigate("/")} />

        {profile && (
          <div className="bg-white p-4 rounded-lg shadow flex items-center justify-between">
            <Link to={`/u/${profile.username}`} className="text-sm font-medium hover:underline">
              {profile.displayName || profile.username}
            </Link>
            {!profile.isMe && (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`text-sm rounded px-4 py-1.5 disabled:opacity-50 ${
                  profile.isFollowedByMe ? "border text-gray-700" : "bg-blue-600 text-white"
                }`}
              >
                {profile.isFollowedByMe ? "Отписаться" : "Подписаться"}
              </button>
            )}
          </div>
        )}

        <PostComments
          postId={post.id}
          onCountChange={(delta) =>
            setPost((p) => (p ? { ...p, commentsCount: p.commentsCount + delta } : p))
          }
        />
      </div>
    </AppLayout>
  );
}