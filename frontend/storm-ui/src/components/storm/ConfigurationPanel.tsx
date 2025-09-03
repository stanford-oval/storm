import * as React from "react";
import { Settings, Save, RotateCcw, Eye, EyeOff, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ConfigurationPanelProps, StormConfig } from "@/types";
import { 
  apiConfig, 
  getLLMConfig, 
  getRetrieverConfig,
  getAvailableLLMProviders,
  getAvailableRetrievers,
  isLLMProviderConfigured,
  isRetrieverConfigured 
} from "@/config/api.config";
import { debugApiKeys } from "@/utils/debug-api-keys";

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onChange,
  onSave,
  onCancel,
  isLoading = false,
  className,
  allowSaveWithoutChanges = false,
}) => {
  // Initialize config with environment variables if API keys are not set
  const initializeConfig = React.useCallback((baseConfig: StormConfig): StormConfig => {
    // Ensure config has proper structure with defaults
    const newConfig: StormConfig = {
      llm: baseConfig?.llm || {
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        temperature: 0.7,
        maxTokens: 4000
      },
      retriever: baseConfig?.retriever || {
        type: 'tavily',
        maxResults: 10
      },
      pipeline: baseConfig?.pipeline || {
        doResearch: true,
        doGenerateOutline: true,
        doGenerateArticle: true,
        doPolishArticle: true,
        maxConvTurns: 3,
        maxPerspectives: 4
      }
    };
    
    // Auto-fill LLM API key from environment if not set
    if (!newConfig.llm.apiKey) {
      const llmConfig = getLLMConfig(newConfig.llm.provider);
      
      if (llmConfig?.apiKey) {
        newConfig.llm.apiKey = llmConfig.apiKey;
      }
      if (llmConfig?.baseUrl) {
        newConfig.llm.baseUrl = llmConfig.baseUrl;
      }
    }
    
    // Auto-fill retriever API key from environment if not set
    if (!newConfig.retriever.apiKey && newConfig.retriever.type !== 'duckduckgo') {
      const retrieverConfig = getRetrieverConfig(newConfig.retriever.type);
      
      if (retrieverConfig?.apiKey) {
        newConfig.retriever.apiKey = retrieverConfig.apiKey;
      }
    }
    
    return newConfig;
  }, []);
  
  const [localConfig, setLocalConfig] = React.useState<StormConfig>(() => initializeConfig(config));
  const [showApiKeys, setShowApiKeys] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Log configuration details after mount to avoid setState during render
  React.useEffect(() => {
    console.log('🔧 Initializing config:', {
      llmProvider: localConfig.llm.provider,
      retrieverType: localConfig.retriever.type,
      hasLlmApiKey: !!localConfig.llm.apiKey,
      hasRetrieverApiKey: !!localConfig.retriever.apiKey
    });
    
    const llmConfig = getLLMConfig(localConfig.llm.provider);
    console.log('📝 LLM Config from environment:', llmConfig ? {
      provider: llmConfig.provider,
      hasApiKey: !!llmConfig.apiKey,
      apiKeyPreview: llmConfig.apiKey ? `${llmConfig.apiKey.substring(0, 10)}...` : 'NOT SET'
    } : 'NOT FOUND');
    
    const retrieverConfig = getRetrieverConfig(localConfig.retriever.type);
    console.log('📝 Retriever Config from environment:', retrieverConfig ? {
      type: retrieverConfig.type,
      hasApiKey: !!retrieverConfig.apiKey,
      apiKeyPreview: retrieverConfig.apiKey ? `${retrieverConfig.apiKey.substring(0, 10)}...` : 'NOT SET'
    } : 'NOT FOUND');
    
    console.log('🎯 Final config state:', {
      hasLlmApiKey: !!localConfig.llm.apiKey,
      hasRetrieverApiKey: !!localConfig.retriever.apiKey
    });
  }, []); // Run only once on mount

  // Track changes
  React.useEffect(() => {
    const isChanged = JSON.stringify(config) !== JSON.stringify(localConfig);
    setHasChanges(isChanged);
  }, [config, localConfig]);

  const handleConfigChange = (path: string, value: any) => {
    setLocalConfig(prev => {
      const keys = path.split('.');
      const newConfig = { ...prev };
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      // Auto-fill API key from environment when provider changes
      if (path === 'llm.provider') {
        const llmConfig = getLLMConfig(value);
        if (llmConfig?.apiKey) {
          newConfig.llm.apiKey = llmConfig.apiKey;
        }
        if (llmConfig?.baseUrl) {
          newConfig.llm.baseUrl = llmConfig.baseUrl;
        }
      }
      
      if (path === 'retriever.type') {
        const retrieverConfig = getRetrieverConfig(value);
        if (retrieverConfig?.apiKey) {
          newConfig.retriever.apiKey = retrieverConfig.apiKey;
        }
      }
      
      return newConfig;
    });
  };

  const handleSave = () => {
    onChange(localConfig);
    onSave();
  };

  const handleReset = () => {
    setLocalConfig(config);
  };

  const llmProviders = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'azure', label: 'Azure OpenAI' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'groq', label: 'Groq' },
  ];

  const retrieverTypes = [
    { value: 'google', label: 'Google Search' },
    { value: 'serper', label: 'Serper (Google API)' },
    { value: 'tavily', label: 'Tavily' },
    { value: 'you', label: 'You.com' },
    { value: 'duckduckgo', label: 'DuckDuckGo (Free)' },
    { value: 'brave', label: 'Brave Search' },
    { value: 'vector', label: 'Vector Database' },
  ];

  const popularModels = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    azure: ['gpt-4', 'gpt-35-turbo'],
    gemini: ['gemini-pro', 'gemini-pro-vision'],
    ollama: ['llama2', 'codellama', 'mistral'],
    groq: ['llama2-70b-4096', 'mixtral-8x7b-32768'],
  };

  return (
    <Card className={cn("w-full max-w-4xl", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Configure language models, retrievers, and pipeline settings
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="h-8 w-8"
            >
              {showApiKeys ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="sr-only">
                {showApiKeys ? 'Hide' : 'Show'} API keys
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="llm" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="llm">Language Model</TabsTrigger>
            <TabsTrigger value="retriever">Retriever</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="llm" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="llm-provider">Provider</Label>
                <Select
                  value={localConfig.llm.provider}
                  onValueChange={(value) => handleConfigChange('llm.provider', value)}
                >
                  <SelectTrigger id="llm-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {llmProviders.map(provider => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-model">Model</Label>
                <Select
                  value={localConfig.llm.model}
                  onValueChange={(value) => handleConfigChange('llm.model', value)}
                >
                  <SelectTrigger id="llm-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {popularModels[localConfig.llm.provider]?.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    )) || (
                      <SelectItem value="custom">Custom Model</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {localConfig.llm.provider === 'azure' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="azure-base-url">Azure Base URL</Label>
                  <Input
                    id="azure-base-url"
                    value={localConfig.llm.baseUrl || ''}
                    onChange={(e) => handleConfigChange('llm.baseUrl', e.target.value)}
                    placeholder="https://your-resource.openai.azure.com/"
                  />
                </div>
              </div>
            )}

            {localConfig.llm.provider === 'ollama' && (
              <div className="space-y-2">
                <Label htmlFor="ollama-base-url">Ollama Base URL</Label>
                <Input
                  id="ollama-base-url"
                  value={localConfig.llm.baseUrl || 'http://localhost:11434'}
                  onChange={(e) => handleConfigChange('llm.baseUrl', e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">
                  API Key
                  {!showApiKeys && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (hidden)
                    </span>
                  )}
                </Label>
                <Input
                  id="api-key"
                  type={showApiKeys ? "text" : "password"}
                  value={localConfig.llm.apiKey || ''}
                  onChange={(e) => handleConfigChange('llm.apiKey', e.target.value)}
                  placeholder="Enter API key"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature
                    <span className="text-xs text-muted-foreground ml-2">
                      (0.0 - 2.0)
                    </span>
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localConfig.llm.temperature || 0.7}
                    onChange={(e) => handleConfigChange('llm.temperature', parseFloat(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">
                    Max Tokens
                    <span className="text-xs text-muted-foreground ml-2">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="1"
                    value={localConfig.llm.maxTokens || ''}
                    onChange={(e) => handleConfigChange('llm.maxTokens', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="retriever" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retriever-type">Retriever Type</Label>
                <Select
                  value={localConfig.retriever.type}
                  onValueChange={(value) => handleConfigChange('retriever.type', value)}
                >
                  <SelectTrigger id="retriever-type">
                    <SelectValue placeholder="Select retriever" />
                  </SelectTrigger>
                  <SelectContent>
                    {retrieverTypes.map(retriever => (
                      <SelectItem key={retriever.value} value={retriever.value}>
                        {retriever.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-results">Max Results</Label>
                <Input
                  id="max-results"
                  type="number"
                  min="1"
                  max="50"
                  value={localConfig.retriever.maxResults || 10}
                  onChange={(e) => handleConfigChange('retriever.maxResults', parseInt(e.target.value))}
                />
              </div>
            </div>

            {localConfig.retriever.type !== 'duckduckgo' && (
              <div className="space-y-2">
                <Label htmlFor="retriever-api-key">
                  API Key
                  {!showApiKeys && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (hidden)
                    </span>
                  )}
                </Label>
                <Input
                  id="retriever-api-key"
                  type={showApiKeys ? "text" : "password"}
                  value={localConfig.retriever.apiKey || ''}
                  onChange={(e) => handleConfigChange('retriever.apiKey', e.target.value)}
                  placeholder="Enter retriever API key"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="do-research">Research Phase</Label>
                  <p className="text-xs text-muted-foreground">
                    Conduct multi-perspective research conversations
                  </p>
                </div>
                <Switch
                  id="do-research"
                  checked={localConfig.pipeline.doResearch}
                  onCheckedChange={(checked) => handleConfigChange('pipeline.doResearch', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="do-outline">Generate Outline</Label>
                  <p className="text-xs text-muted-foreground">
                    Create structured article outline
                  </p>
                </div>
                <Switch
                  id="do-outline"
                  checked={localConfig.pipeline.doGenerateOutline}
                  onCheckedChange={(checked) => handleConfigChange('pipeline.doGenerateOutline', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="do-article">Generate Article</Label>
                  <p className="text-xs text-muted-foreground">
                    Write full article sections
                  </p>
                </div>
                <Switch
                  id="do-article"
                  checked={localConfig.pipeline.doGenerateArticle}
                  onCheckedChange={(checked) => handleConfigChange('pipeline.doGenerateArticle', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="do-polish">Polish Article</Label>
                  <p className="text-xs text-muted-foreground">
                    Add summaries and remove duplicates
                  </p>
                </div>
                <Switch
                  id="do-polish"
                  checked={localConfig.pipeline.doPolishArticle}
                  onCheckedChange={(checked) => handleConfigChange('pipeline.doPolishArticle', checked)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-conv-turns">
                    Max Conversation Turns
                    <span className="text-xs text-muted-foreground ml-2">
                      (per perspective)
                    </span>
                  </Label>
                  <Input
                    id="max-conv-turns"
                    type="number"
                    min="1"
                    max="20"
                    value={localConfig.pipeline.maxConvTurns || 5}
                    onChange={(e) => handleConfigChange('pipeline.maxConvTurns', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-perspectives">
                    Max Perspectives
                    <span className="text-xs text-muted-foreground ml-2">
                      (research viewpoints)
                    </span>
                  </Label>
                  <Input
                    id="max-perspectives"
                    type="number"
                    min="1"
                    max="10"
                    value={localConfig.pipeline.maxPerspectives || 4}
                    onChange={(e) => handleConfigChange('pipeline.maxPerspectives', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || isLoading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={(!hasChanges && !allowSaveWithoutChanges) || isLoading}
              className="min-w-[80px]"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

ConfigurationPanel.displayName = "ConfigurationPanel";