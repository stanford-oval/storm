import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  FileText,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatDate, generateId } from '@/lib/utils';
import type {
  OutlineEditorProps,
  ArticleOutline,
  OutlineSection,
} from '@/types';

interface SortableSectionProps {
  section: OutlineSection;
  sections: OutlineSection[];
  onUpdate: (section: OutlineSection) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleExpand: (id: string) => void;
  readOnly: boolean;
}

const SortableSection: React.FC<SortableSectionProps> = ({
  section,
  sections,
  onUpdate,
  onDelete,
  onAddChild,
  onToggleExpand,
  readOnly,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(section.title);
  const [editDescription, setEditDescription] = React.useState(
    section.description || ''
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    disabled: readOnly || isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const childSections = sections.filter(s => s.parentId === section.id);
  const hasChildren = childSections.length > 0;

  const handleSave = () => {
    const updatedSection: OutlineSection = {
      ...section,
      title: editTitle.trim() || 'Untitled',
      description: editDescription.trim() || undefined,
    };
    onUpdate(updatedSection);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(section.title);
    setEditDescription(section.description || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const indentClass = `ml-${Math.min(section.level * 4, 16)}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative',
        isDragging && 'z-10 opacity-50',
        indentClass
      )}
    >
      <div
        className={cn(
          'flex items-center space-x-2 rounded-md border p-2 transition-colors',
          isEditing ? 'border-primary bg-primary/5' : 'hover:bg-accent'
        )}
      >
        {!readOnly && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 flex-shrink-0 p-0"
            onClick={() => onToggleExpand(section.id)}
          >
            {section.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Section title"
                className="h-8 text-sm"
                autoFocus
              />
              <Input
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Description (optional)"
                className="h-7 text-xs"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <p className="truncate text-sm font-medium">{section.title}</p>
                <Badge variant="outline" className="text-xs">
                  H{section.level}
                </Badge>
              </div>
              {section.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {section.description}
                </p>
              )}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleSave}
                >
                  <Save className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleCancel}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onAddChild(section.id)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onDelete(section.id)}
                >
                  <Trash2 className="h-3 w-3 text-red-600" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Render children */}
      {hasChildren && section.isExpanded && (
        <div className="mt-2">
          <SortableContext
            items={childSections.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {childSections
              .sort((a, b) => a.order - b.order)
              .map(childSection => (
                <SortableSection
                  key={childSection.id}
                  section={childSection}
                  sections={sections}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onToggleExpand={onToggleExpand}
                  readOnly={readOnly}
                />
              ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
};

export const OutlineEditor: React.FC<OutlineEditorProps> = ({
  outline,
  onChange,
  onSave,
  readOnly = false,
  className,
}) => {
  const [localOutline, setLocalOutline] =
    React.useState<ArticleOutline>(outline);
  const [hasChanges, setHasChanges] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track changes
  React.useEffect(() => {
    const isChanged = JSON.stringify(outline) !== JSON.stringify(localOutline);
    setHasChanges(isChanged);
  }, [outline, localOutline]);

  const updateOutline = (updatedSections: OutlineSection[]) => {
    const newOutline = {
      ...localOutline,
      sections: updatedSections,
      lastModified: new Date(),
    };
    setLocalOutline(newOutline);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOutline.sections.findIndex(s => s.id === active.id);
      const newIndex = localOutline.sections.findIndex(s => s.id === over.id);

      const newSections = arrayMove(localOutline.sections, oldIndex, newIndex);

      // Update order numbers
      const updatedSections = newSections.map((section, index) => ({
        ...section,
        order: index + 1,
      }));

      updateOutline(updatedSections);
    }
  };

  const handleUpdateSection = (updatedSection: OutlineSection) => {
    const updatedSections = localOutline.sections.map(section =>
      section.id === updatedSection.id ? updatedSection : section
    );
    updateOutline(updatedSections);
  };

  const handleDeleteSection = (id: string) => {
    // Also delete all children
    const deleteWithChildren = (
      sections: OutlineSection[],
      targetId: string
    ): OutlineSection[] => {
      const childIds = sections
        .filter(s => s.parentId === targetId)
        .map(s => s.id);
      let filtered = sections.filter(s => s.id !== targetId);

      childIds.forEach(childId => {
        filtered = deleteWithChildren(filtered, childId);
      });

      return filtered;
    };

    const updatedSections = deleteWithChildren(localOutline.sections, id);
    updateOutline(updatedSections);
  };

  const handleAddSection = (parentId?: string) => {
    const parentSection = parentId
      ? localOutline.sections.find(s => s.id === parentId)
      : null;

    const newSection: OutlineSection = {
      id: generateId(),
      title: 'New Section',
      level: parentSection ? Math.min(parentSection.level + 1, 6) : 1,
      order: localOutline.sections.length + 1,
      parentId,
      isExpanded: true,
    };

    const updatedSections = [...localOutline.sections, newSection];
    updateOutline(updatedSections);

    // Expand parent if it exists
    if (parentSection && !parentSection.isExpanded) {
      handleToggleExpand(parentId!);
    }
  };

  const handleToggleExpand = (id: string) => {
    const updatedSections = localOutline.sections.map(section =>
      section.id === id
        ? { ...section, isExpanded: !section.isExpanded }
        : section
    );
    updateOutline(updatedSections);
  };

  const handleSave = () => {
    onChange(localOutline);
    onSave();
  };

  const handleReset = () => {
    setLocalOutline(outline);
  };

  const rootSections = localOutline.sections.filter(s => !s.parentId);
  const totalSections = localOutline.sections.length;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">
              Article Outline
            </CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <FileText className="mr-1 h-3 w-3" />
                <span>
                  {totalSections} section{totalSections !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                <span>Modified {formatDate(localOutline.lastModified)}</span>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddSection()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
              {hasChanges && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {rootSections.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2 text-lg font-medium">No sections yet</p>
            <p className="mb-4 text-sm">
              Start building your article outline by adding sections
            </p>
            {!readOnly && (
              <Button onClick={() => handleAddSection()}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Section
              </Button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rootSections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {rootSections
                  .sort((a, b) => a.order - b.order)
                  .map(section => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      sections={localOutline.sections}
                      onUpdate={handleUpdateSection}
                      onDelete={handleDeleteSection}
                      onAddChild={handleAddSection}
                      onToggleExpand={handleToggleExpand}
                      readOnly={readOnly}
                    />
                  ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {hasChanges && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You have unsaved changes. Don't forget to save your outline.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

OutlineEditor.displayName = 'OutlineEditor';
