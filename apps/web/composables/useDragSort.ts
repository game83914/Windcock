import type { Ref } from 'vue';
import type Sortable from 'sortablejs';

export function useDragSort(
  container: Ref<HTMLElement | null>,
  onReorder: (from: number, to: number) => void,
  handle = '[data-drag-handle]',
) {
  let instance: Sortable | null = null;

  async function bind(el: HTMLElement | null) {
    instance?.destroy();
    instance = null;
    if (!el) return;
    const { default: SortableCtor } = await import('sortablejs');
    if (container.value !== el) return;
    instance = SortableCtor.create(el, {
      handle,
      animation: 150,
      onEnd: (event) => {
        if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex) return;
        onReorder(event.oldIndex, event.newIndex);
      },
    });
  }

  watch(container, (el) => { void bind(el); }, { flush: 'post' });
  onBeforeUnmount(() => instance?.destroy());
}
