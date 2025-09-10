import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content, className }) => {
  return (
    <div
      className={cn(
        'prose prose-gray max-w-none dark:prose-invert',
        'prose-headings:scroll-mt-20',
        'prose-h1:mb-4 prose-h1:text-3xl prose-h1:font-bold',
        'prose-h2:mb-4 prose-h2:mt-8 prose-h2:text-2xl prose-h2:font-semibold',
        'prose-h3:mb-3 prose-h3:mt-6 prose-h3:text-xl prose-h3:font-semibold',
        'prose-h4:mb-2 prose-h4:mt-4 prose-h4:text-lg prose-h4:font-medium',
        'prose-p:mb-4 prose-p:text-base prose-p:leading-7',
        'prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6',
        'prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6',
        'prose-li:mb-2',
        'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic',
        'prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm dark:prose-code:bg-gray-800',
        'prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-gray-100 prose-pre:p-4 dark:prose-pre:bg-gray-800',
        'prose-a:text-blue-600 prose-a:underline hover:prose-a:no-underline dark:prose-a:text-blue-400',
        'prose-img:rounded-lg prose-img:shadow-md',
        'prose-table:w-full prose-table:border-collapse',
        'prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2 dark:prose-th:border-gray-600 dark:prose-th:bg-gray-800',
        'prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2 dark:prose-td:border-gray-600',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom renderers for specific elements if needed
          h1: ({ children, ...props }) => (
            <h1 className="mb-4 mt-8 text-3xl font-bold first:mt-0" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mb-4 mt-8 text-2xl font-semibold" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mb-3 mt-6 text-xl font-semibold" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="mb-2 mt-4 text-lg font-medium" {...props}>
              {children}
            </h4>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-4 leading-7" {...props}>
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul className="my-4 list-disc space-y-2 pl-6" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="mb-1" {...props}>
              {children}
            </li>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-4 border-l-4 border-gray-300 pl-4 italic text-gray-700 dark:border-gray-600 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          ),
          code: ({ inline, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm dark:bg-gray-800"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-sm" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre
              className="my-4 overflow-x-auto rounded-lg bg-gray-100 p-4 dark:bg-gray-800"
              {...props}
            >
              {children}
            </pre>
          ),
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-blue-600 underline hover:no-underline dark:text-blue-400"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border border-gray-300 px-4 py-2 text-left font-semibold dark:border-gray-600"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="border border-gray-300 px-4 py-2 dark:border-gray-600"
              {...props}
            >
              {children}
            </td>
          ),
          hr: ({ ...props }) => (
            <hr
              className="my-8 border-gray-300 dark:border-gray-600"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
