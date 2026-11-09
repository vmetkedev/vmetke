// Склеивает серию вызовов в один, который срабатывает через ms после первого
export function coalesce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
  run.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return run;
}