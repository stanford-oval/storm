'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  Book,
  Video,
  MessageCircle,
  ExternalLink,
  Github,
  Mail,
  FileText,
  Zap,
  Code,
  Terminal,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    {
      question: 'What is STORM?',
      answer:
        'STORM (Synthesis of Topic Outline through Retrieval and Multi-perspective question asking) is an AI-powered system that generates comprehensive Wikipedia-like articles through automated research and writing.',
    },
    {
      question: 'How do I get started?',
      answer:
        '1. Set up your API keys in Settings\n2. Create a new project\n3. Configure your pipeline settings\n4. Run the pipeline to generate your article',
    },
    {
      question: 'What API keys do I need?',
      answer:
        'You need at least one LLM provider key (OpenAI or Anthropic) and one search provider key (Google, Tavily, Serper, etc.). Configure these in the Settings page.',
    },
    {
      question: 'How long does article generation take?',
      answer:
        'Typically 5-15 minutes depending on the topic complexity, chosen model, and pipeline configuration. Research phase usually takes the longest.',
    },
    {
      question: 'Can I edit the generated articles?',
      answer:
        'Yes! Articles can be edited after generation. You can also modify the outline before article generation to influence the final output.',
    },
    {
      question: "What's the difference between models?",
      answer:
        'GPT-4 provides the highest quality but is slower and more expensive. GPT-3.5 is faster and cheaper but may produce less nuanced content. Claude models offer a good balance.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'Costs depend on your chosen models and article length. Typically $0.20-$1.00 per article with GPT-3.5, or $1-5 with GPT-4.',
    },
    {
      question: 'Can I use my own documents?',
      answer:
        'Yes! You can configure a vector database (Qdrant) to use your own document corpus for research instead of web search.',
    },
  ];

  const quickGuides = [
    {
      title: 'Create Your First Article',
      icon: <Zap className="h-5 w-5" />,
      steps: [
        "Click 'New Project' from the dashboard",
        'Enter your topic and description',
        'Choose your LLM and search providers',
        "Click 'Create & Run Pipeline'",
        'Wait for generation to complete',
      ],
    },
    {
      title: 'Configure API Keys',
      icon: <Terminal className="h-5 w-5" />,
      steps: [
        'Go to Settings → API Keys',
        'Enter your OpenAI or Anthropic key',
        'Add at least one search provider key',
        'Test each key to verify it works',
        'Save your settings',
      ],
    },
    {
      title: 'Optimize for Quality',
      icon: <Lightbulb className="h-5 w-5" />,
      steps: [
        'Use GPT-4 for best results',
        'Enable all pipeline stages',
        'Increase max conversation turns',
        'Add more perspectives for research',
        'Enable article polishing',
      ],
    },
    {
      title: 'Optimize for Speed',
      icon: <Zap className="h-5 w-5" />,
      steps: [
        'Use GPT-3.5-turbo',
        'Reduce max conversation turns',
        'Limit perspectives to 3-4',
        'Use faster search providers',
        'Skip polishing stage',
      ],
    },
  ];

  const resources = [
    {
      title: 'STORM Paper',
      description: 'Original research paper from Stanford',
      icon: <FileText className="h-5 w-5" />,
      link: 'https://arxiv.org/abs/2402.14207',
      type: 'Research',
    },
    {
      title: 'GitHub Repository',
      description: 'Source code and documentation',
      icon: <Github className="h-5 w-5" />,
      link: 'https://github.com/stanford-oval/storm',
      type: 'Code',
    },
    {
      title: 'API Documentation',
      description: 'Backend API reference',
      icon: <Code className="h-5 w-5" />,
      link: '/api/docs',
      type: 'Docs',
    },
    {
      title: 'Video Tutorial',
      description: 'Complete walkthrough guide',
      icon: <Video className="h-5 w-5" />,
      link: '#',
      type: 'Tutorial',
    },
  ];

  const shortcuts = [
    { keys: ['Ctrl', 'K'], action: 'Open command palette' },
    { keys: ['Ctrl', 'N'], action: 'Create new project' },
    { keys: ['Ctrl', 'S'], action: 'Save changes' },
    { keys: ['Ctrl', '/'], action: 'Toggle help' },
    { keys: ['Esc'], action: 'Close modal/dialog' },
  ];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">Help & Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about using STORM UI
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button>Search</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="getting-started" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="getting-started" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quickGuides.map((guide, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {guide.icon}
                    <span>{guide.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {guide.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start">
                        <span className="mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Keyboard Shortcuts</CardTitle>
              <CardDescription>
                Speed up your workflow with these shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.action}</span>
                    <div className="flex space-x-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Research Stage</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  The research stage simulates conversations between AI agents
                  with different perspectives to gather comprehensive
                  information about your topic.
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>
                    <strong>Max Conversation Turns:</strong> More turns = more
                    thorough research (5-10 recommended)
                  </li>
                  <li>
                    <strong>Max Perspectives:</strong> Number of different
                    viewpoints to explore (3-5 recommended)
                  </li>
                  <li>
                    <strong>Search Results:</strong> More results provide better
                    coverage but take longer
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 font-semibold">Outline Generation</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  Creates a structured outline based on the research findings.
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Review and edit the outline before article generation</li>
                  <li>Add or remove sections as needed</li>
                  <li>Reorder sections for better flow</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 font-semibold">Article Writing</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  Generates the full article based on the outline and research.
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Each section is written with citations</li>
                  <li>Maintains consistency across sections</li>
                  <li>Typical length: 2000-5000 words</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 font-semibold">Polish Stage</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  Final refinement of the article.
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>Adds executive summary</li>
                  <li>Improves transitions</li>
                  <li>Removes redundancy</li>
                  <li>Fixes formatting issues</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {faq.answer}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {resources.map((resource, index) => (
              <Card key={index} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {resource.icon}
                      <CardTitle className="text-base">
                        {resource.title}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary">{resource.type}</Badge>
                  </div>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={resource.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Resource
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Get Support</CardTitle>
              <CardDescription>We're here to help</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center space-x-3">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Community Forum</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Get help from the community and share your experiences
                    </p>
                    <Button variant="outline" className="w-full">
                      Visit Forum
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center space-x-3">
                      <Github className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">GitHub Issues</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Report bugs or request features
                    </p>
                    <Button variant="outline" className="w-full">
                      Open Issue
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Email Support</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Direct support for critical issues
                    </p>
                    <Button variant="outline" className="w-full">
                      Contact Support
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="mb-3 flex items-center space-x-3">
                      <Book className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Documentation</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Comprehensive guides and API reference
                    </p>
                    <Button variant="outline" className="w-full">
                      Read Docs
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold">System Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API Server</span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">
                        Operational
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Search Services</span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">
                        Operational
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">LLM Providers</span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-500">
                        Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
