import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Save,
  Eye,
  FileText,
  Clock,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn, formatDate, estimateReadingTime } from "@/lib/utils";
import type { ArticleEditorProps, GeneratedArticle, Citation } from "@/types";

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  article,
  onChange,
  onSave,
  readOnly = false,
  showOutline = true,
  className,
}) => {
  const [activeTab, setActiveTab] = React.useState<string>("editor");
  const [wordCount, setWordCount] = React.useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-md',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: article.content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      const wordCount = editor.storage.characterCount?.words() || 0;
      setWordCount(wordCount);

      // Update article content
      const updatedArticle: GeneratedArticle = {
        ...article,
        content,
        wordCount,
        lastModified: new Date(),
      };
      onChange(updatedArticle);
    },
  });

  React.useEffect(() => {
    if (editor && article.content !== editor.getHTML()) {
      editor.commands.setContent(article.content);
    }
  }, [article.content, editor]);

  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }> = ({ onClick, isActive, children, title }) => (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );

  const toolbar = editor && (
    <div className="flex items-center space-x-1 p-2 border-b">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6" />

      <ToolbarButton
        onClick={() => {
          const url = window.prompt("Enter URL");
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive("link")}
        title="Add Link"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => {
          const url = window.prompt("Enter image URL");
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }}
        title="Add Image"
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert Table"
      >
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );

  const ArticleStats = () => (
    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
      <div className="flex items-center">
        <FileText className="mr-1 h-3 w-3" />
        <span>{article.wordCount?.toLocaleString() || 0} words</span>
      </div>
      <div className="flex items-center">
        <Clock className="mr-1 h-3 w-3" />
        <span>{estimateReadingTime(article.content)} min read</span>
      </div>
      <div className="flex items-center">
        <BookOpen className="mr-1 h-3 w-3" />
        <span>{article.sections?.length || 0} sections</span>
      </div>
      {article.lastModified && (
        <div>
          Modified {formatDate(article.lastModified)}
        </div>
      )}
    </div>
  );

  const CitationsList = ({ citations }: { citations: Citation[] }) => (
    <div className="space-y-2">
      {citations.map((citation, index) => (
        <div key={citation.id} className="p-3 bg-muted/50 rounded-md text-sm">
          <div className="flex items-start justify-between mb-1">
            <span className="font-medium">
              [{index + 1}] {citation.text}
            </span>
            <Badge variant="outline" className="ml-2">
              {citation.page && `p.${citation.page}`}
            </Badge>
          </div>
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate block"
          >
            {citation.url}
          </a>
        </div>
      ))}
    </div>
  );

  const OutlineView = () => (
    <div className="space-y-2">
      {article.sections?.map((section, index) => (
        <div
          key={section.id}
          className={cn(
            "p-2 rounded-md border cursor-pointer hover:bg-accent",
            `pl-${Math.min(section.level * 4, 12)}`
          )}
          onClick={() => {
            // Find heading in editor and scroll to it
            const heading = document.querySelector(`h${section.level}:nth-of-type(${section.order})`);
            if (heading) {
              heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
        >
          <div className="font-medium text-sm">{section.title}</div>
          {section.citations.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {section.citations.length} citation{section.citations.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn("flex h-full", className)}>
      <div className="flex-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">
                {article.title}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab(activeTab === "editor" ? "preview" : "editor")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {activeTab === "editor" ? "Preview" : "Edit"}
                </Button>
                {!readOnly && (
                  <Button size="sm" onClick={onSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                )}
              </div>
            </div>
            <ArticleStats />
          </CardHeader>

          <CardContent className="flex-1 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="citations">Citations</TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="flex-1 flex flex-col mt-4">
                <div className="border rounded-lg flex-1 flex flex-col">
                  {!readOnly && toolbar}
                  <div className="flex-1 p-4 overflow-auto storm-scrollbar">
                    <EditorContent 
                      editor={editor} 
                      className="prose max-w-none focus:outline-none"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 mt-4">
                <div className="border rounded-lg p-6 overflow-auto storm-scrollbar">
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="citations" className="flex-1 mt-4">
                <div className="border rounded-lg p-4 overflow-auto storm-scrollbar">
                  <h3 className="font-semibold mb-4">
                    Citations ({article.citations?.length || 0})
                  </h3>
                  {article.citations && article.citations.length > 0 ? (
                    <CitationsList citations={article.citations} />
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No citations available
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Outline Sidebar */}
      {showOutline && article.sections && article.sections.length > 0 && (
        <div className="w-80 border-l pl-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Outline</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto storm-scrollbar">
              <OutlineView />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

ArticleEditor.displayName = "ArticleEditor";