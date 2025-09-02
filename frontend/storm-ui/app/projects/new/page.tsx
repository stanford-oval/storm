'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfigurationPanel } from '@/components/storm/ConfigurationPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useProjectStore, useNotificationStore } from '@/store';
import { StormConfig, CreateProjectFormData } from '@/types/storm';
import { AnimatedPage } from '@/utils/animations/AnimatedPage';
import { ResponsiveContainer } from '@/components/ux/ResponsiveContainer';
import { useProjectStore as getProjectStore } from '@/store/slices/projectStore';
import { 
  ArrowLeft, 
  Save, 
  Zap, 
  Settings, 
  FileText,
  Brain,
  Search,
  Wand2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Default configuration
const DEFAULT_CONFIG: StormConfig = {
  llm: {
    model: 'gpt-4o',  // Updated to match .env.local default
    provider: 'openai',
    temperature: 0.7,  // Updated to match .env.local default
    maxTokens: 4000,
  },
  retriever: {
    type: 'tavily',  // Changed to tavily since we have the API key configured
    maxResults: 10,
  },
  pipeline: {
    doResearch: true,
    doGenerateOutline: true,
    doGenerateArticle: true,
    doPolishArticle: true,
    maxConvTurns: 5,
    maxPerspectives: 4,
  },
};

// Form validation
const validateForm = (data: CreateProjectFormData) => {
  const errors: Record<string, string> = {};
  
  if (!data.title.trim()) {
    errors.title = 'Project title is required';
  } else if (data.title.length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (data.title.length > 100) {
    errors.title = 'Title must be less than 100 characters';
  }
  
  if (!data.topic.trim()) {
    errors.topic = 'Research topic is required';
  } else if (data.topic.length < 5) {
    errors.topic = 'Topic must be at least 5 characters';
  } else if (data.topic.length > 200) {
    errors.topic = 'Topic must be less than 200 characters';
  }

  if (data.description && data.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  // Validate LLM config
  if (!data.config.llm.model) {
    errors.llmModel = 'LLM model is required';
  }

  if (!data.config.retriever.type) {
    errors.retrieverType = 'Retriever type is required';
  }

  return errors;
};

export default function NewProjectPage() {
  const router = useRouter();
  const { createProject, loading } = useProjectStore();
  const { addNotification } = useNotificationStore();

  // Form state
  const [formData, setFormData] = useState<CreateProjectFormData>({
    title: '',
    topic: '',
    description: '',
    config: DEFAULT_CONFIG,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<'basic' | 'advanced'>('basic');

  // Handle form changes
  const handleBasicInfoChange = (field: keyof Pick<CreateProjectFormData, 'title' | 'topic' | 'description'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleConfigChange = (config: StormConfig) => {
    setFormData(prev => ({ ...prev, config }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Ensure we're validating the current form data
    console.log('Submitting with formData:', formData);
    
    const formErrors = validateForm(formData);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      console.error('Validation errors:', formErrors);
      console.error('Form data:', formData);
      
      // If we're on the advanced step and have basic field errors, go back to basic
      if (currentStep === 'advanced' && (formErrors.title || formErrors.topic)) {
        setCurrentStep('basic');
        addNotification({
          type: 'error',
          title: 'Missing Information',
          message: 'Please complete the basic information first',
        });
        return;
      }
      
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the form errors before continuing: ' + Object.values(formErrors).join(', '),
      });
      return;
    }

    try {
      console.log('Calling createProject with:', formData);
      const result = await createProject(formData);
      console.log('Raw result from createProject:', result);
      console.log('Result type:', typeof result);
      console.log('Result is null?', result === null);
      console.log('Result is undefined?', result === undefined);
      
      // Try to get the project from the store after creation
      const store = getProjectStore.getState();
      console.log('Store state after creation:', store);
      const project = result || store.currentProject;
      console.log('Project after fallback:', project);
      
      if (!project || !project.id) {
        console.error('Invalid project returned:', project);
        console.error('Store currentProject:', store.currentProject);
        console.error('Store projects:', store.projects);
        throw new Error('Project creation returned invalid data');
      }
      
      addNotification({
        type: 'success',
        title: 'Project Created',
        message: `"${formData.title}" has been created successfully`,
      });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create project',
      });
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  const canProceed = formData.title.trim() && formData.topic.trim();

  return (
    <AnimatedPage>
      <ResponsiveContainer className="py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancel}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
            <p className="text-muted-foreground">
              Set up a new STORM knowledge curation project
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center">
          <div className="flex items-center max-w-md w-full">
            <div className="flex items-center flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                currentStep === 'basic' ? "bg-primary text-primary-foreground" : "bg-green-500 text-white"
              )}>
                {currentStep === 'basic' ? '1' : '✓'}
              </div>
              <span className={cn(
                "ml-2 font-medium",
                currentStep === 'basic' ? "text-foreground" : "text-muted-foreground"
              )}>
                Basic Information
              </span>
            </div>
            
            <div className="w-16 mx-2">
              <div className={cn(
                "h-px transition-colors",
                currentStep === 'advanced' ? "bg-primary" : canProceed ? "bg-primary/50" : "bg-border"
              )} />
            </div>
            
            <div className="flex items-center flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                currentStep === 'advanced' ? "bg-primary text-primary-foreground" : 
                canProceed ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                2
              </div>
              <span className={cn(
                "ml-2 font-medium",
                currentStep === 'advanced' ? "text-foreground" : 
                canProceed ? "text-primary" : "text-muted-foreground"
              )}>
                Configuration
              </span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 'basic' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Project Details
                  </CardTitle>
                  <CardDescription>
                    Provide basic information about your knowledge curation project
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Climate Change Impact on Agriculture"
                      value={formData.title}
                      onChange={(e) => handleBasicInfoChange('title', e.target.value)}
                      className={errors.title ? 'border-destructive' : ''}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {errors.title}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topic">Research Topic *</Label>
                    <Input
                      id="topic"
                      placeholder="e.g., How does climate change affect agricultural productivity globally?"
                      value={formData.topic}
                      onChange={(e) => handleBasicInfoChange('topic', e.target.value)}
                      className={errors.topic ? 'border-destructive' : ''}
                    />
                    {errors.topic && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {errors.topic}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      This will be the main research question that guides the article generation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide additional context or specific aspects you'd like to focus on..."
                      value={formData.description}
                      onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                      className={cn("min-h-[100px]", errors.description ? 'border-destructive' : '')}
                    />
                    {errors.description && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {errors.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formData.description.length}/500 characters
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('advanced')}
                      disabled={!canProceed}
                    >
                      Next: Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 'advanced' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Advanced Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure the AI models and research parameters for your project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConfigurationPanel
                    config={formData.config}
                    onChange={handleConfigChange}
                    onSave={handleSubmit}
                    onCancel={() => setCurrentStep('basic')}
                    isLoading={loading}
                    allowSaveWithoutChanges={true}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Project Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Project Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <p className="text-sm font-medium">
                    {formData.title || 'Untitled Project'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Topic</Label>
                  <p className="text-sm">
                    {formData.topic || 'No topic specified'}
                  </p>
                </div>
                {formData.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Steps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pipeline Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                    formData.config.pipeline.doResearch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Search className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Research</p>
                    <p className="text-xs text-muted-foreground">Multi-perspective information gathering</p>
                  </div>
                  {formData.config.pipeline.doResearch && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                    formData.config.pipeline.doGenerateOutline ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Brain className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Outline Generation</p>
                    <p className="text-xs text-muted-foreground">Structure the article content</p>
                  </div>
                  {formData.config.pipeline.doGenerateOutline && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                    formData.config.pipeline.doGenerateArticle ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <FileText className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Article Writing</p>
                    <p className="text-xs text-muted-foreground">Generate the full article</p>
                  </div>
                  {formData.config.pipeline.doGenerateArticle && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                    formData.config.pipeline.doPolishArticle ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    <Wand2 className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Article Polishing</p>
                    <p className="text-xs text-muted-foreground">Final refinements and citations</p>
                  </div>
                  {formData.config.pipeline.doPolishArticle && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Model Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Model Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Language Model</span>
                  <Badge variant="secondary" className="text-xs">
                    {formData.config.llm.model}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Provider</span>
                  <Badge variant="outline" className="text-xs">
                    {formData.config.llm.provider}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Retriever</span>
                  <Badge variant="outline" className="text-xs">
                    {formData.config.retriever.type}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ResponsiveContainer>
    </AnimatedPage>
  );
}