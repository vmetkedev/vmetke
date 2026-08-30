import { useNavigate } from "react-router";
import { PostComposer } from "../components/PostComposer";
import { AppLayout } from "../components/AppLayout";

export default function NewPostPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-xl font-semibold mb-4 system-dark:text-gray-100">Новый пост</h1>
        <PostComposer onPosted={() => navigate("/")} />
      </div>
    </AppLayout>
  );
}