'use client';

import { useId, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, GripIcon } from './icons';

export type SortableItemControls = {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  dragging: boolean;
  /** 40×40 drag handle button (the only place a drag can start) */
  handle: ReactNode;
  moveUp: () => void;
  moveDown: () => void;
  /** the two always-visible arrow buttons (phone fallback) */
  arrows: ReactNode;
};

export type SortableListProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, ctl: SortableItemControls) => ReactNode;
  ariaLabel: string;
  /** default 'list' */
  layout?: 'list' | 'grid' | 'horizontal';
  /** default Move up/Move down ('list'); Move left/Move right ('grid', 'horizontal') */
  arrowLabels?: { prev: string; next: string };
  disabled?: boolean;
  /** shown as a hint above the list while disabled */
  disabledReason?: string;
};

const arrowBtn =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink-dark disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

function SortableItem<T>({
  item,
  id,
  index,
  count,
  layout,
  labels,
  disabled,
  move,
  renderItem,
}: {
  item: T;
  id: string;
  index: number;
  count: number;
  layout: 'list' | 'grid' | 'horizontal';
  labels: { prev: string; next: string };
  disabled: boolean;
  move: (from: number, to: number) => void;
  renderItem: SortableListProps<T>['renderItem'];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const moveUp = () => !isFirst && move(index, index - 1);
  const moveDown = () => !isLast && move(index, index + 1);
  const PrevIcon = layout === 'list' ? ArrowUpIcon : ArrowLeftIcon;
  const NextIcon = layout === 'list' ? ArrowDownIcon : ArrowRightIcon;

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      data-testid="drag-handle"
      disabled={disabled}
      style={{ touchAction: 'none' }}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-ink-dark disabled:cursor-not-allowed disabled:opacity-30 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <GripIcon className="h-5 w-5" />
    </button>
  );
  const arrows = (
    <span className="inline-flex shrink-0">
      <button type="button" className={arrowBtn} onClick={moveUp} disabled={disabled || isFirst} aria-label={labels.prev} title={labels.prev}>
        <PrevIcon className="h-4 w-4" />
      </button>
      <button type="button" className={arrowBtn} onClick={moveDown} disabled={disabled || isLast} aria-label={labels.next} title={labels.next}>
        <NextIcon className="h-4 w-4" />
      </button>
    </span>
  );

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      data-testid="sortable-item"
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
      className={isDragging ? 'opacity-80 shadow-lg' : undefined}
    >
      {renderItem(item, { index, isFirst, isLast, dragging: isDragging, handle, moveUp, moveDown, arrows })}
    </div>
  );
}

/** Drag-and-drop ordering (handle only) plus arrow buttons. Each list owns its DndContext, so lists can nest. */
export function SortableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
  ariaLabel,
  layout = 'list',
  arrowLabels,
  disabled = false,
  disabledReason,
}: SortableListProps<T>) {
  const id = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const labels = arrowLabels ?? (layout === 'list' ? { prev: 'Move up', next: 'Move down' } : { prev: 'Move left', next: 'Move right' });
  const keys = items.map(getKey);
  const strategy = layout === 'grid' ? rectSortingStrategy : layout === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    onReorder(arrayMove(items, from, to));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(keys.indexOf(String(e.active.id)), keys.indexOf(String(e.over.id)));
  };

  const containerClass =
    layout === 'grid'
      ? 'grid grid-cols-2 gap-3 md:grid-cols-4'
      : layout === 'horizontal'
        ? 'flex flex-wrap gap-2'
        : 'flex flex-col gap-2';

  return (
    <div>
      {disabled && disabledReason && <p className="mb-2 text-xs text-gray-500">{disabledReason}</p>}
      <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={strategy} disabled={disabled}>
          <div role="list" aria-label={ariaLabel} className={containerClass}>
            {items.map((item, index) => (
              <SortableItem
                key={keys[index]}
                id={keys[index]}
                item={item}
                index={index}
                count={items.length}
                layout={layout}
                labels={labels}
                disabled={disabled}
                move={move}
                renderItem={renderItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
