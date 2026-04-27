import Link from "next/link";
import { posts } from "@/data/home";

export function CategoriaGrid() {
  return (
    <section className="hidden">
      <h2 className="text-3xl text-[#132960]">Categorias em destaque</h2>
      <div className="grid gap-8 md:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="az-card border-t-4 border-t-[#027DFC] p-5">
            <h3 className="text-lg text-[#132960]">{post.category}</h3>
            <p className="mt-2 text-sm text-zinc-600">{post.author}</p>
            <h4 className="mt-3 text-xl leading-snug text-[#132960]">
              <Link href={post.slug} className="hover:text-[#FF5713]">
                {post.title}
              </Link>
            </h4>
            <p className="mt-3 text-sm text-zinc-500">{post.date}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
