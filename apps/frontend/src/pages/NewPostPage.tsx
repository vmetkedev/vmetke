import { useNavigate } from "react-router";
import { PostComposer } from "../components/PostComposer";

export default function NewPostPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-semibold mb-4">Новый пост</h1>
      <PostComposer onPosted={() => navigate("/")} />
    </div>
  );
}