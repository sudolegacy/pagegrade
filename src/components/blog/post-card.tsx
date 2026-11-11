import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CATEGORIES, readingMinutes, type Post } from '@/content/blog';
import { longDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export function PostMeta({ post, className }: { post: Post; className?: string }) {
  const date = post.updated ?? post.published;
  return (
    <p className={cn('text-[12.5px] text-zinc-500', className)}>
      {post.updated ? 'Updated ' : ''}<time dateTime={date}>{longDate(Date.parse(date))}</time> · {readingMinutes(post.body)} min read
      {post.status === 'draft' && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Draft</span>}
    </p>
  );
}

export function PostCard({ post, large, headingLevel = 'h2' }: { post: Post; large?: boolean; headingLevel?: 'h2' | 'h3' }) {
  const H = headingLevel;
  return (
    <Link href={`/blog/${post.slug}`} className={cn('card group flex h-full flex-col transition-shadow hover:shadow-pop', large ? 'p-7 sm:p-8' : 'p-6')}>
      <p className="text-[12.5px] font-medium text-brand-700">{CATEGORIES[post.category].name}</p>
      <H className={cn('mt-2 font-semibold leading-snug text-ink group-hover:text-brand-800', large ? 'text-[22px] sm:text-[26px]' : 'text-[18px]')}>{post.title}</H>
      <p className={cn('mt-2 flex-1 leading-relaxed text-zinc-600', large ? 'text-[15.5px]' : 'text-[14.5px]')}>{post.excerpt}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <PostMeta post={post} />
        <ArrowRight className="size-4 shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
