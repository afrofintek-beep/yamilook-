import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, GripVertical, Check } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLongPress } from '@/hooks/useLongPress';

export interface HighlightItem {
  id: string;
  title: string;
  coverUrl: string | null;
  isPinned?: boolean;
  isBranded?: boolean;
}

interface EmptyState {
  hideZeroText?: boolean;
  title: string;
  subtitle: string;
  cta?: {
    label: string;
    action: string;
  };
}

interface ProfileHighlightsProps {
  title: string;
  subtitle?: string;
  items: HighlightItem[];
  emptyState?: EmptyState;
  isOwner?: boolean;
  loading?: boolean;
  onCreateHighlight?: () => void;
  onHighlightClick?: (id: string) => void;
  onReorder?: (orderedIds: string[]) => Promise<void>;
}

interface SortableHighlightProps {
  item: HighlightItem;
  index: number;
  isEditMode: boolean;
  onClick: () => void;
}

function SortableHighlight({ item, index, isEditMode, onClick }: SortableHighlightProps) {
  useUiLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 flex flex-col items-center gap-2 ${isDragging ? 'opacity-80' : ''}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 + index * 0.05 }}
    >
      <button
        onClick={isEditMode ? undefined : onClick}
        className="relative"
        {...(isEditMode ? { ...attributes, ...listeners } : {})}
      >
        <motion.div
          className={`w-16 h-16 rounded-full ring-2 ring-[#C9A23F]/30 ring-offset-2 ring-offset-background overflow-hidden bg-muted ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
          whileHover={isEditMode ? {} : { scale: 1.05 }}
          whileTap={isEditMode ? {} : { scale: 0.95 }}
          animate={isDragging ? { scale: 1.1 } : {}}
        >
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xl font-bold">
              {item.title[0]?.toUpperCase()}
            </div>
          )}
        </motion.div>

        {/* Drag indicator in edit mode */}
        <AnimatePresence>
          {isEditMode && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg"
            >
              <GripVertical className="w-3 h-3 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
      <span className="text-[10px] text-foreground font-medium max-w-16 truncate">
        {item.title}
      </span>
    </motion.div>
  );
}

export function ProfileHighlights({
  title,
  subtitle,
  items,
  emptyState,
  isOwner = false,
  loading = false,
  onCreateHighlight,
  onHighlightClick,
  onReorder,
}: ProfileHighlightsProps) {
  useUiLocale();
  const { t } = useTranslation();
  const hasItems = items && items.length > 0;
  const [isEditMode, setIsEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<HighlightItem[]>(items);

  // Sync local items with props when not in edit mode
  if (!isEditMode && JSON.stringify(localItems) !== JSON.stringify(items)) {
    setLocalItems(items);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { handlers: longPressHandlers } = useLongPress({
    onLongPress: () => {
      if (isOwner && hasItems && onReorder) {
        setIsEditMode(true);
      }
    },
    delay: 500,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    if (onReorder) {
      await onReorder(localItems.map((i) => i.id));
    }
    setIsEditMode(false);
  };

  if (loading) {
    return (
      <div className="mb-6 px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="h-2 w-10 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasItems && !isOwner) return null;

  const displayItems = isEditMode ? localItems : items;

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.3 }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-6 mb-4">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Save button in edit mode */}
        <AnimatePresence>
          {isEditMode && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleSaveOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              <Check className="w-3.5 h-3.5" />{uiText("Guardar")}</motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Highlights scroll area */}
      {hasItems || isOwner ? (
        <ScrollArea className="w-full">
          <div className="flex gap-3 px-6 pb-2" {...(isOwner && hasItems ? longPressHandlers : {})}>
            {/* Pinned YAMILOOK branded Momambo */}
            {!isEditMode && (
              <motion.button
                onClick={() => onHighlightClick?.('m_yamilook')}
                className="flex-shrink-0 flex flex-col items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-16 h-16 rounded-full ring-2 ring-[#F2A900]/50 ring-offset-2 ring-offset-background overflow-hidden flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #F2A900 0%, #E67E22 50%, #C0392B 100%)' }}>
                  <span className="text-white text-[8px] font-light tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{uiText("yamilook")}</span>
                </div>
                <span className="text-[10px] text-foreground font-medium">
                  YAMILOOK
                </span>
              </motion.button>
            )}

            {/* Add new momambo button for owner */}
            {isOwner && !isEditMode && (
              <motion.button
                onClick={onCreateHighlight}
                className="flex-shrink-0 flex flex-col items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center hover:border-primary/60 hover:from-primary/30 transition-all duration-200">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-foreground font-semibold leading-tight">{uiText("Novo")}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{uiText("Momambo")}</span>
                </div>
              </motion.button>
            )}

            {/* Highlight items with drag-and-drop */}
            {isEditMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayItems.map((i) => i.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {displayItems.map((item, index) => (
                    <SortableHighlight
                      key={item.id}
                      item={item}
                      index={index}
                      isEditMode={isEditMode}
                      onClick={() => onHighlightClick?.(item.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              displayItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  onClick={() => onHighlightClick?.(item.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="w-16 h-16 rounded-full ring-2 ring-[#C9A23F]/30 ring-offset-2 ring-offset-background overflow-hidden bg-muted">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xl font-bold">
                        {item.title[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground font-medium max-w-16 truncate">
                    {item.title}
                  </span>
                </motion.button>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      ) : (
        /* Empty state for owner */
        isOwner && emptyState && (
          <div className="px-6">
            <motion.button
              onClick={onCreateHighlight}
              className="w-full p-6 rounded-2xl bg-muted/40 border border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/60 transition-colors text-center"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                {emptyState.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {emptyState.subtitle}
              </p>
            </motion.button>
          </div>
        )
      )}

      {/* Edit mode hint */}
      {isOwner && hasItems && !isEditMode && (
        <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-60">{uiText("Segure para reorganizar")}</p>
      )}
    </motion.div>
  );
}
