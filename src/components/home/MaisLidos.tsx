import { PostCard, type PostCardData } from "@/components/common/PostCard";

export function MaisLidos({ posts }: { posts: PostCardData[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-4xl text-[#027DFC]">Leia também</h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
}
