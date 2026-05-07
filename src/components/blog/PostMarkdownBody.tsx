import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const MD_WRAP =
  "space-y-4 text-[15px] leading-7 text-zinc-800 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#027DFC]/30 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-700 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#132960] [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[#132960] [&_strong]:font-semibold [&_a]:font-medium [&_a]:text-[#027DFC] [&_a]:underline [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_img]:mx-auto [&_img]:my-6 [&_img]:max-h-[min(480px,70vh)] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:text-sm [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-zinc-100 [&_hr]:my-8 [&_hr]:border-[#132960]/15";

type PostMarkdownBodyProps = {
  markdown: string;
};

export function PostMarkdownBody({ markdown }: PostMarkdownBodyProps) {
  return (
    <div className={MD_WRAP}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children, ...props }) => {
            if (!href) {
              return <span {...props}>{children}</span>;
            }
            if (href.startsWith("http://") || href.startsWith("https://")) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              );
            }
            return (
              <Link href={href} {...props}>
                {children}
              </Link>
            );
          },
          img: ({ src, alt }) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element -- user markdown; remote URLs vary
              <img src={src} alt={alt ?? ""} loading="lazy" />
            ) : null,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
