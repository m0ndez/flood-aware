// AbortSignal.timeout() needs Safari 16 and AbortSignal.any() needs Safari 17.4 / Chrome 116. An AbortController plus a
// timer works on every browser, and on older iPhones the missing API would otherwise fail every camera fetch silently.
export function withTimeout(ms: number, parent?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const onParent = () => ctl.abort();
  if (parent) {
    if (parent.aborted) ctl.abort();
    else parent.addEventListener("abort", onParent, { once: true });
  }
  return {
    signal: ctl.signal,
    done() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParent);
    },
  };
}
