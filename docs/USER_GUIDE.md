# STORM UI User Guide

Welcome to the STORM UI - your comprehensive web-based interface for automated knowledge curation and collaborative article generation. This guide will help you master all features of the STORM system.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Project Management](#project-management)
4. [STORM Pipeline](#storm-pipeline)
5. [Co-STORM Collaboration](#co-storm-collaboration)
6. [Configuration Management](#configuration-management)
7. [Article Editing and Export](#article-editing-and-export)
8. [Analytics and Monitoring](#analytics-and-monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Getting Started

### System Requirements

- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+
- **Internet Connection**: Stable connection required for API calls
- **Screen Resolution**: Minimum 1024x768 (optimized for 1920x1080)

### First-Time Setup

1. **Access the Application**
   - Navigate to your STORM UI installation
   - If using locally: `http://localhost:3000`

2. **API Configuration**
   - Go to Settings → API Keys
   - Configure required API keys:
     - **OpenAI API Key**: For GPT models
     - **Bing Search API Key**: For web search
     - **Additional Keys**: Based on your chosen providers
   - Test connections using the "Validate Keys" button

3. **User Preferences**
   - Set your preferred theme (Light/Dark/System)
   - Configure notification preferences
   - Set default project configurations

### Navigation Overview

The STORM UI features a clean, intuitive interface:

- **Top Navigation**: Project actions, user menu, notifications
- **Left Sidebar**: Main navigation (Dashboard, Projects, Settings, Analytics)
- **Main Content**: Context-dependent workspace
- **Right Panel**: Contextual information and tools

## Dashboard Overview

### Quick Stats
Your dashboard displays key metrics:
- **Total Projects**: All projects in your workspace
- **Active Pipelines**: Currently running processes
- **Completed Articles**: Successfully generated content
- **Usage Statistics**: API calls, processing time, costs

### Recent Activity
Track your latest work:
- Recently created projects
- Pipeline completions
- Collaborative sessions
- System notifications

### Quick Actions
- **New Project**: Start a fresh research project
- **Continue Pipeline**: Resume paused processes
- **Join Session**: Enter collaborative discussions
- **View Analytics**: Access detailed usage reports

## Project Management

### Creating a New Project

1. **Basic Information**
   - **Title**: Clear, descriptive project name
   - **Topic**: Main subject of research
   - **Description**: Optional detailed explanation
   - **Tags**: Organize projects with keywords

2. **Configuration Selection**
   - Choose from predefined templates or create custom configuration
   - Templates available:
     - **Academic Research**: Scholarly article generation
     - **Journalistic**: News-style reporting
     - **Technical Documentation**: How-to guides and tutorials
     - **Business Analysis**: Market research and reports

3. **Collaboration Settings**
   - Set project visibility (Private/Team/Public)
   - Add collaborators with specific roles
   - Configure sharing permissions

### Project Organization

**Filtering and Search**
- Filter by status: Draft, In Progress, Completed, Archived
- Search by title, topic, or tags
- Sort by creation date, last modified, or status
- Use advanced filters for date ranges and collaborators

**Bulk Operations**
- Select multiple projects for batch operations
- Archive, delete, or change settings for multiple projects
- Export project lists and statistics

**Project Templates**
Save frequently used configurations as templates:
- Standard academic papers
- News articles
- Product documentation
- Research reports

## STORM Pipeline

The STORM pipeline consists of four main stages. Understanding each stage helps optimize your results.

### Stage 1: Research

**Overview**: Simulates multi-perspective conversations to gather comprehensive information.

**Process**:
1. **Topic Analysis**: Breaks down your topic into research questions
2. **Perspective Generation**: Creates expert viewpoints (academic, journalistic, critical)
3. **Conversation Simulation**: AI experts discuss the topic, citing sources
4. **Source Aggregation**: Compiles and ranks information sources

**Monitoring**:
- View real-time conversation logs
- Track source discovery progress
- Monitor relevance scores for gathered information
- Review expert perspectives being simulated

**Configuration Options**:
- **Max Conversations**: Number of expert discussions (1-10)
- **Conversation Depth**: Length of each discussion (1-5)
- **Perspectives**: Types of experts to simulate
- **Source Types**: Web, academic, news, or custom corpus

### Stage 2: Outline Generation

**Overview**: Organizes research findings into a structured article outline.

**Process**:
1. **Information Synthesis**: Analyzes conversation outputs
2. **Topic Hierarchy**: Creates main sections and subsections
3. **Source Assignment**: Maps sources to relevant sections
4. **Word Count Estimation**: Predicts article length

**Interaction**:
- Review generated outline structure
- Edit section titles and descriptions
- Reorder sections using drag-and-drop
- Add custom sections or remove unwanted ones
- Adjust word count targets per section

**Quality Indicators**:
- **Coverage Score**: How well outline covers the topic
- **Source Distribution**: Balance of sources across sections
- **Coherence Rating**: Logical flow between sections

### Stage 3: Article Generation

**Overview**: Writes article content based on the approved outline.

**Process**:
1. **Section Writing**: Generates content for each section
2. **Citation Integration**: Embeds source references
3. **Cross-References**: Links related concepts
4. **Style Consistency**: Maintains uniform writing style

**Monitoring**:
- Track progress per section
- Review generated content in real-time
- Monitor citation accuracy
- Check for coherence between sections

**Quality Controls**:
- **Factual Accuracy**: Verification against sources
- **Citation Completeness**: All claims properly sourced
- **Readability Score**: Content accessibility level
- **Plagiarism Check**: Originality verification

### Stage 4: Polish

**Overview**: Refines the article for publication quality.

**Process**:
1. **Summary Generation**: Creates abstract and conclusion
2. **Duplicate Removal**: Eliminates redundant content
3. **Flow Optimization**: Improves transitions between sections
4. **Final Formatting**: Ensures consistent structure

**Output Quality**:
- **Coherence Score**: Overall article flow rating
- **Completeness Check**: All sections properly developed
- **Citation Validation**: Reference accuracy verification
- **Style Compliance**: Adherence to chosen format

### Pipeline Controls

**Start Pipeline**
- Select which stages to run
- Choose to run full pipeline or individual stages
- Set stage-specific parameters
- Schedule pipeline execution

**Monitoring**
- Real-time progress indicators
- Detailed logging for each stage
- Performance metrics and timing
- Resource usage tracking

**Control Options**
- **Pause**: Temporarily halt execution
- **Resume**: Continue from last checkpoint
- **Stop**: Cancel pipeline with option to save progress
- **Restart**: Begin again from selected stage

## Co-STORM Collaboration

Co-STORM enables real-time collaboration between humans and AI experts for knowledge curation.

### Creating a Collaborative Session

1. **Session Setup**
   - Link to existing project or create new one
   - Set session parameters:
     - Maximum participants (3-10)
     - Session duration limit
     - Moderation level (Low/Medium/High)
   - Configure AI expert personalities and expertise areas

2. **Participant Management**
   - Invite human collaborators via email
   - Configure AI expert participants
   - Set roles and permissions
   - Monitor participant activity

### Interactive Discourse

**Real-time Conversation**
- Text-based chat interface
- AI experts respond contextually
- Human moderator guides discussion
- Turn-based or free-form interaction modes

**Mind Map Integration**
- Visual knowledge representation
- Real-time updates during conversation
- Collaborative node editing
- Concept relationship mapping

**Question Suggestion System**
- AI-generated follow-up questions
- Context-aware query recommendations
- Topic expansion suggestions
- Fact-checking prompts

### Knowledge Organization

**Dynamic Mind Map**
- **Node Creation**: Add concepts during discussion
- **Relationship Mapping**: Connect related ideas
- **Evidence Linking**: Attach sources to concepts
- **Collaborative Editing**: Multiple users edit simultaneously

**Information Capture**
- Automatic extraction of key points
- Source citation during conversation
- Fact verification in real-time
- Export conversation transcripts

**Report Generation**
- Convert session outcomes to structured article
- Maintain conversation attribution
- Include mind map as visual aid
- Export in various formats

### Session Management

**Moderation Tools**
- Guide conversation flow
- Manage speaking turns
- Highlight important insights
- Resolve conflicting information

**Quality Control**
- Fact-checking assistance
- Source verification
- Bias detection alerts
- Completeness monitoring

## Configuration Management

### Language Models

**Provider Options**:
- **OpenAI**: GPT-3.5, GPT-4, GPT-4-Turbo
- **Anthropic**: Claude-2, Claude-Instant
- **Azure OpenAI**: Enterprise-grade GPT models
- **Local Models**: Support for locally hosted models

**Configuration Parameters**:
- **Temperature**: Creativity vs. consistency (0.0-1.0)
- **Max Tokens**: Response length limit
- **Top-p**: Nucleus sampling parameter
- **Frequency Penalty**: Repetition reduction

**Stage-Specific Models**:
- Use different models for different pipeline stages
- Optimize cost vs. quality trade-offs
- Configure fallback models for reliability

### Retrieval Systems

**Search Providers**:
- **Bing Search**: Comprehensive web search
- **Google Search**: Alternative web search (via API)
- **DuckDuckGo**: Privacy-focused search
- **You.com**: AI-powered search
- **Tavily**: Research-optimized search
- **Brave Search**: Independent search engine

**Custom Corpus**:
- Upload document collections
- Configure vector database (Qdrant)
- Set similarity thresholds
- Manage document preprocessing

**Search Parameters**:
- **Max Results**: Number of sources per query (5-50)
- **Date Filters**: Restrict to recent content
- **Domain Filters**: Include/exclude specific websites
- **Language Settings**: Multi-language support
- **Content Types**: Web, academic, news, images

### Validation and Testing

**Configuration Validation**:
- API key verification
- Model availability checks
- Rate limit testing
- Cost estimation

**Template Management**:
- Save configurations as templates
- Share templates with team members
- Version control for configurations
- Import/export configuration files

## Article Editing and Export

### Rich Text Editor

The built-in editor provides:
- **WYSIWYG editing**: Visual content editing
- **Markdown support**: Raw markdown editing option
- **Citation management**: Integrated reference handling
- **Table support**: Create and edit data tables
- **Image insertion**: Add and position images
- **Link management**: Internal and external linking

### Citation Management

**Automatic Citations**:
- Sources automatically cited during generation
- Multiple citation styles (APA, MLA, Chicago)
- In-text citations with reference list
- Hyperlinked citations for web sources

**Manual Citation Editing**:
- Add custom citations
- Edit citation details
- Format citation styles
- Validate citation completeness

### Content Organization

**Section Management**:
- Reorder sections via drag-and-drop
- Split or merge sections
- Add custom sections
- Hide/show sections

**Version Control**:
- Automatic saving with version history
- Compare different versions
- Restore previous versions
- Branch and merge capabilities

### Export Options

**Format Support**:
- **PDF**: Publication-ready documents
- **Word (DOCX)**: Editable document format
- **HTML**: Web-friendly format with embedded styles
- **Markdown**: Plain text with formatting
- **LaTeX**: Academic publishing format

**Export Configuration**:
- **Template Selection**: Academic, business, or custom layouts
- **Section Inclusion**: Choose which sections to export
- **Citation Style**: Format references appropriately
- **Image Quality**: Optimize for print or web
- **Metadata**: Include author, date, and project information

**Batch Export**:
- Export multiple projects simultaneously
- Apply consistent formatting across articles
- Generate project summaries
- Create publication-ready collections

### Sharing and Collaboration

**Share Links**:
- Generate public or private share links
- Set expiration dates for shared content
- Password protection for sensitive content
- Track access and usage statistics

**Real-time Collaboration**:
- Multiple editors working simultaneously
- Live cursor tracking
- Comment and suggestion system
- Conflict resolution for simultaneous edits

**Publication Workflow**:
- Review and approval process
- Publication scheduling
- Integration with content management systems
- Social media sharing integration

## Analytics and Monitoring

### Usage Analytics

**Project Statistics**:
- Total projects created
- Pipeline completion rates
- Average processing time per stage
- Success/failure ratios

**Resource Utilization**:
- API call tracking by service
- Token usage and costs
- Processing time analysis
- Error rate monitoring

**User Activity**:
- Login frequency and session duration
- Feature usage patterns
- Collaboration participation
- Export and sharing statistics

### Performance Monitoring

**System Health**:
- API response times
- Service availability
- Error rates and types
- Resource consumption

**Quality Metrics**:
- Article completeness scores
- Citation accuracy rates
- User satisfaction ratings
- Content quality assessments

### Custom Dashboards

**Personalized Views**:
- Create custom metric dashboards
- Set up alerts for important events
- Track progress toward goals
- Compare performance across projects

**Team Analytics**:
- Collaborative session statistics
- Team productivity metrics
- Resource sharing patterns
- Knowledge base growth

## Troubleshooting

### Common Issues and Solutions

#### API Connection Problems

**Symptoms**:
- "API key invalid" errors
- Connection timeout messages
- Rate limit exceeded warnings

**Solutions**:
1. **Verify API Keys**:
   - Check key format and validity
   - Ensure sufficient credits/quota
   - Test keys in provider dashboard

2. **Network Issues**:
   - Check internet connectivity
   - Verify firewall settings
   - Try different network if possible

3. **Rate Limiting**:
   - Reduce concurrent requests
   - Implement request spacing
   - Upgrade API plan if needed

#### Pipeline Failures

**Research Stage Issues**:
- **No Sources Found**: Broaden search terms or check search provider settings
- **Low-Quality Results**: Adjust relevance thresholds or add more search providers
- **Conversation Errors**: Check language model configuration and token limits

**Outline Generation Problems**:
- **Incoherent Structure**: Review research quality and try different outline templates
- **Missing Sections**: Ensure comprehensive research coverage
- **Duplicate Content**: Adjust outline generation parameters

**Article Generation Issues**:
- **Incomplete Sections**: Check token limits and increase if necessary
- **Poor Quality**: Try different language models or adjust temperature settings
- **Citation Errors**: Verify source quality and citation format settings

#### Performance Issues

**Slow Processing**:
- Check system resources and API response times
- Reduce concurrent operations
- Optimize configuration for speed vs. quality

**Memory Problems**:
- Clear browser cache and local storage
- Reduce project size or complexity
- Close unnecessary browser tabs

### Error Messages Reference

#### Authentication Errors
- `AUTH_001: Invalid API key`: Check and re-enter your API keys
- `AUTH_002: Token expired`: Log out and log back in
- `AUTH_003: Insufficient permissions`: Contact administrator

#### Configuration Errors
- `CONFIG_001: Invalid temperature value`: Must be between 0.0 and 1.0
- `CONFIG_002: Model not available`: Check model availability in your region
- `CONFIG_003: Token limit too low`: Increase max tokens setting

#### Processing Errors
- `PROC_001: Pipeline timeout`: Increase timeout settings or reduce scope
- `PROC_002: Insufficient sources`: Add more search providers or broaden topic
- `PROC_003: Quality threshold not met`: Lower quality requirements or improve inputs

### Getting Help

**Documentation Resources**:
- This user guide
- API documentation
- Video tutorials
- FAQ section

**Community Support**:
- User forums and discussions
- GitHub issues and feature requests
- Community-contributed templates
- Best practices sharing

**Technical Support**:
- Contact system administrator
- Submit detailed bug reports
- Request feature enhancements
- Schedule training sessions

## Best Practices

### Project Planning

**Topic Selection**:
- Choose well-defined, focused topics
- Avoid overly broad or narrow subjects
- Consider available source material
- Plan for target audience and purpose

**Configuration Optimization**:
- Start with standard templates
- Adjust based on initial results
- Balance cost, speed, and quality
- Test configurations with small projects

### Research Phase Optimization

**Query Crafting**:
- Use specific, varied search terms
- Include synonyms and related concepts
- Consider different languages if relevant
- Test query effectiveness in search engines

**Source Diversity**:
- Use multiple search providers
- Include various content types
- Consider publication dates and relevance
- Verify source credibility

**Quality Control**:
- Review conversation outputs regularly
- Check for bias in expert perspectives
- Validate factual claims
- Ensure comprehensive coverage

### Content Generation

**Outline Review**:
- Carefully review generated outlines
- Ensure logical flow and completeness
- Add domain-specific sections if needed
- Consider target audience requirements

**Writing Quality**:
- Choose appropriate language models
- Set suitable creativity levels
- Review generated content promptly
- Maintain consistent style and tone

**Citation Management**:
- Verify citation accuracy
- Check for proper attribution
- Ensure citation style consistency
- Include diverse, credible sources

### Collaboration Best Practices

**Session Planning**:
- Define clear objectives
- Prepare background materials
- Set time limits and agendas
- Choose appropriate AI expert configurations

**Facilitation**:
- Guide discussions constructively
- Encourage diverse perspectives
- Maintain focus on objectives
- Document key insights

**Knowledge Organization**:
- Structure mind maps clearly
- Use consistent terminology
- Link concepts meaningfully
- Export and share results

### Quality Assurance

**Regular Reviews**:
- Check content at each pipeline stage
- Verify facts against original sources
- Assess completeness and coherence
- Review citation accuracy

**Feedback Integration**:
- Gather user feedback on generated content
- Iterate on configurations based on results
- Share successful templates with team
- Document lessons learned

**Continuous Improvement**:
- Monitor analytics for trends
- Update configurations based on performance
- Stay current with model capabilities
- Participate in community best practices

### Security and Privacy

**API Key Management**:
- Keep API keys secure and private
- Rotate keys regularly
- Monitor usage for unusual activity
- Use environment variables in deployments

**Content Protection**:
- Be mindful of sensitive information
- Review content before sharing
- Use appropriate privacy settings
- Consider data retention policies

**Compliance**:
- Follow institutional guidelines
- Respect copyright and fair use
- Maintain appropriate attribution
- Consider legal requirements for your use case

---

## Conclusion

The STORM UI provides a powerful platform for automated knowledge curation and collaborative research. By following this guide and adopting the recommended best practices, you'll be able to create high-quality, well-researched articles efficiently and effectively.

For additional support, updates, and community resources, visit our documentation website or join our user community. Happy researching!

---

*Last updated: September 2025*
*Version: 1.0*