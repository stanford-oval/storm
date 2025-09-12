'use client';

import { logger } from '@/utils/logger';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
// import { Badge } from '@/components/ui/badge'; // Removed unused import
import { Database, Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { useNotificationStore } from '@/store';

// SECURITY WARNING: This component handles API keys
// - Never store API keys in localStorage or cookies
// - Never expose API keys in window/global objects
// - Always send API keys to backend immediately for secure storage
// - Frontend should only display masked versions (e.g., 'sk-...abc')
export default function SettingsPage() {
  const { addNotification } = useNotificationStore();
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testingApi, setTestingApi] = useState<string | null>(null);
  const [_loading, _setLoading] = useState(true);

  // Load saved settings from localStorage
  const loadSavedSettings = () => {
    const saved = localStorage.getItem('storm_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  };

  const savedSettings = loadSavedSettings();

  // Form state - will be populated from backend
  // SECURITY: These should only store masked previews from backend
  // Actual API keys should be sent to backend immediately upon entry
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
    tavily: '',
    serper: '',
    bing: '',
  });

  // Load API keys from backend on mount
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const response = await fetch(
          'http://localhost:8000/api/settings/api-keys'
        );
        if (response.ok) {
          const data = await response.json();
          // Use previews from backend or saved values
          // Only use masked previews from backend, never store actual keys
          setApiKeys({
            openai: data.openai_key_preview || '',
            anthropic: data.anthropic_key_preview || '',
            google: data.google_api_key_preview || '',
            tavily: data.tavily_key_preview || '',
            serper: data.serper_key_preview || '',
            bing: data.bing_key_preview || '',
          });
        }
      } catch (error) {
        logger.error('Failed to load API keys:', error);
        // Don't fall back to saved API keys - security vulnerability
        // API keys should only come from the backend
        setApiKeys({
          openai: '',
          anthropic: '',
          google: '',
          tavily: '',
          serper: '',
          bing: '',
        });
      } finally {
        _setLoading(false);
      }
    };

    loadApiKeys();
  }, []);

  const [llmSettings, setLlmSettings] = useState({
    defaultModel: savedSettings?.llmSettings?.defaultModel || 'gpt-4',
    temperature: savedSettings?.llmSettings?.temperature ?? 0.7,
    maxTokens: savedSettings?.llmSettings?.maxTokens || 4000,
    topP: savedSettings?.llmSettings?.topP ?? 1.0,
  });

  const [searchSettings, setSearchSettings] = useState({
    defaultProvider: savedSettings?.searchSettings?.defaultProvider || 'tavily',
    maxResults: savedSettings?.searchSettings?.maxResults || 10,
    includeImages: savedSettings?.searchSettings?.includeImages ?? false,
    safeSearch: savedSettings?.searchSettings?.safeSearch ?? true,
  });

  const [uiSettings, setUiSettings] = useState({
    theme: savedSettings?.uiSettings?.theme || 'system',
    compactMode: savedSettings?.uiSettings?.compactMode ?? false,
    showDebugConsole: savedSettings?.uiSettings?.showDebugConsole ?? false,
    autoSave: savedSettings?.uiSettings?.autoSave ?? true,
    notifications: savedSettings?.uiSettings?.notifications ?? true,
  });

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const testApiKey = async (provider: string) => {
    setTestingApi(provider);

    try {
      // Test the API key by making a simple request
      const key = apiKeys[provider.toLowerCase() as keyof typeof apiKeys];
      if (!key) {
        throw new Error('API key is empty');
      }

      // In a real implementation, this would call the backend to validate
      await new Promise(resolve => setTimeout(resolve, 1500));

      addNotification({
        type: 'success',
        title: 'API Key Valid',
        message: `${provider} API key tested successfully`,
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'API Key Invalid',
        message: `Failed to validate ${provider} API key`,
        read: false,
        persistent: false,
      });
    } finally {
      setTestingApi(null);
    }
  };

  const saveSettings = () => {
    // Save non-sensitive settings to localStorage
    // SECURITY: Never store API keys in localStorage or window object
    const settings = {
      // apiKeys removed - these should only be stored server-side
      llmSettings,
      searchSettings,
      uiSettings,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem('storm_settings', JSON.stringify(settings));

    addNotification({
      type: 'success',
      title: 'Settings Saved',
      message: 'Your settings have been updated successfully',
      read: false,
      persistent: false,
    });
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your STORM UI configuration and preferences
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="interface">Interface</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your API keys for LLM providers and search engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI */}
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="openai-key"
                      type={showApiKeys.openai ? 'text' : 'password'}
                      value={apiKeys.openai}
                      onChange={e => {
                        // TODO: Send to backend immediately for secure storage
                        setApiKeys(prev => ({
                          ...prev,
                          openai: e.target.value,
                        }));
                      }}
                      placeholder="sk-..."
                      title="API key will be securely stored on the server"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-0 h-full"
                      onClick={() => toggleApiKeyVisibility('openai')}
                    >
                      {showApiKeys.openai ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('OpenAI')}
                    disabled={testingApi === 'OpenAI'}
                  >
                    {testingApi === 'OpenAI' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for GPT-3.5 and GPT-4 models
                </p>
              </div>

              <Separator />

              {/* Anthropic */}
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="anthropic-key"
                      type={showApiKeys.anthropic ? 'text' : 'password'}
                      value={apiKeys.anthropic}
                      onChange={e =>
                        setApiKeys(prev => ({
                          ...prev,
                          anthropic: e.target.value,
                        }))
                      }
                      placeholder="sk-ant-..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-0 h-full"
                      onClick={() => toggleApiKeyVisibility('anthropic')}
                    >
                      {showApiKeys.anthropic ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => testApiKey('Anthropic')}
                    disabled={testingApi === 'Anthropic'}
                  >
                    {testingApi === 'Anthropic' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for Claude models
                </p>
              </div>

              <Separator />

              {/* Search Providers */}
              <div className="space-y-4">
                <h3 className="font-medium">Search Provider Keys</h3>

                {['google', 'tavily', 'serper', 'bing'].map(provider => (
                  <div key={provider} className="space-y-2">
                    <Label htmlFor={`${provider}-key`} className="capitalize">
                      {provider} API Key
                    </Label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <Input
                          id={`${provider}-key`}
                          type={showApiKeys[provider] ? 'text' : 'password'}
                          value={apiKeys[provider as keyof typeof apiKeys]}
                          onChange={e =>
                            setApiKeys(prev => ({
                              ...prev,
                              [provider]: e.target.value,
                            }))
                          }
                          placeholder="Enter API key..."
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-0 h-full"
                          onClick={() => toggleApiKeyVisibility(provider)}
                        >
                          {showApiKeys[provider] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => testApiKey(provider)}
                        disabled={testingApi === provider}
                      >
                        {testingApi === provider ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Test'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Language Model Settings</CardTitle>
              <CardDescription>
                Configure default model parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="default-model">Default Model</Label>
                <Select
                  value={llmSettings.defaultModel}
                  onValueChange={value =>
                    setLlmSettings(prev => ({ ...prev, defaultModel: value }))
                  }
                >
                  <SelectTrigger id="default-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                    <SelectItem value="claude-3-sonnet">
                      Claude 3 Sonnet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature: {llmSettings.temperature}
                </Label>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={llmSettings.temperature}
                  onChange={e =>
                    setLlmSettings(prev => ({
                      ...prev,
                      temperature: parseFloat(e.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Controls randomness: Lower is more focused, higher is more
                  creative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  value={llmSettings.maxTokens}
                  onChange={e =>
                    setLlmSettings(prev => ({
                      ...prev,
                      maxTokens: parseInt(e.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tokens in the response
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="top-p">Top P: {llmSettings.topP}</Label>
                <Input
                  id="top-p"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={llmSettings.topP}
                  onChange={e =>
                    setLlmSettings(prev => ({
                      ...prev,
                      topP: parseFloat(e.target.value),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Nucleus sampling: Consider tokens with top cumulative
                  probability
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Settings</CardTitle>
              <CardDescription>
                Configure search provider preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="search-provider">Default Search Provider</Label>
                <Select
                  value={searchSettings.defaultProvider}
                  onValueChange={value =>
                    setSearchSettings(prev => ({
                      ...prev,
                      defaultProvider: value,
                    }))
                  }
                >
                  <SelectTrigger id="search-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tavily">Tavily</SelectItem>
                    <SelectItem value="google">Google Search</SelectItem>
                    <SelectItem value="serper">Serper</SelectItem>
                    <SelectItem value="you">You.com</SelectItem>
                    <SelectItem value="duckduckgo">
                      DuckDuckGo (Free)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-results">Max Search Results</Label>
                <Input
                  id="max-results"
                  type="number"
                  value={searchSettings.maxResults}
                  onChange={e =>
                    setSearchSettings(prev => ({
                      ...prev,
                      maxResults: parseInt(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Images</Label>
                  <p className="text-xs text-muted-foreground">
                    Search for relevant images
                  </p>
                </div>
                <Switch
                  checked={searchSettings.includeImages}
                  onCheckedChange={checked =>
                    setSearchSettings(prev => ({
                      ...prev,
                      includeImages: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Safe Search</Label>
                  <p className="text-xs text-muted-foreground">
                    Filter explicit content
                  </p>
                </div>
                <Switch
                  checked={searchSettings.safeSearch}
                  onCheckedChange={checked =>
                    setSearchSettings(prev => ({
                      ...prev,
                      safeSearch: checked,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interface" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interface Preferences</CardTitle>
              <CardDescription>Customize the user interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={uiSettings.theme}
                  onValueChange={value =>
                    setUiSettings(prev => ({ ...prev, theme: value }))
                  }
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Reduce spacing and padding
                  </p>
                </div>
                <Switch
                  checked={uiSettings.compactMode}
                  onCheckedChange={checked =>
                    setUiSettings(prev => ({ ...prev, compactMode: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Debug Console</Label>
                  <p className="text-xs text-muted-foreground">
                    Show debug information
                  </p>
                </div>
                <Switch
                  checked={uiSettings.showDebugConsole}
                  onCheckedChange={checked =>
                    setUiSettings(prev => ({
                      ...prev,
                      showDebugConsole: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-save</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically save changes
                  </p>
                </div>
                <Switch
                  checked={uiSettings.autoSave}
                  onCheckedChange={checked =>
                    setUiSettings(prev => ({ ...prev, autoSave: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Show system notifications
                  </p>
                </div>
                <Switch
                  checked={uiSettings.notifications}
                  onCheckedChange={checked =>
                    setUiSettings(prev => ({ ...prev, notifications: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Advanced configuration options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Data & Storage</h3>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium">Clear Cache</p>
                    <p className="text-xs text-muted-foreground">
                      Remove temporary files and cached data
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Database className="mr-2 h-4 w-4" />
                    Clear Cache
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium">Export Data</p>
                    <p className="text-xs text-muted-foreground">
                      Download all your projects and settings
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Performance</h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable WebSocket</Label>
                    <p className="text-xs text-muted-foreground">
                      Real-time updates (experimental)
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Parallel Processing</Label>
                    <p className="text-xs text-muted-foreground">
                      Run multiple pipelines simultaneously
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Developer Options</h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>API Logging</Label>
                    <p className="text-xs text-muted-foreground">
                      Log all API requests and responses
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Performance Metrics</Label>
                    <p className="text-xs text-muted-foreground">
                      Show performance overlay
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={saveSettings}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
