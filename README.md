# Customer Ticket Queue Visualizer

An interactive, animated demo of an **array-based circular queue** (ring buffer) using customer support tickets. Built with plain HTML + CSS + vanilla JavaScript — no frameworks, no build step.




## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `E` | Enqueue (add next ticket) |
| `D` | Dequeue (serve front ticket) |

---

## Sample Trace (verify in Operation Log)

| Step | Op | Rear | Front | Array (slot 0–4) |
|------|----|------|-------|-----------------|
| 1 | Enqueue T101 | 0 | 0 | T101, —, —, —, — |
| 2 | Enqueue T102 | 1 | 0 | T101, T102, —, —, — |
| 3 | Enqueue T103 | 2 | 0 | T101, T102, T103, —, — |
| 4 | Dequeue T101 | 2 | 1 | —, T102, T103, —, — |
| 5 | Enqueue T104 | 3 | 1 | —, T102, T103, T104, — |
| 6 | Enqueue T105 | 4 | 1 | —, T102, T103, T104, T105 |
| 7 | **Enqueue T106 ↻ WRAP** | **0** | 1 | T106, T102, T103, T104, T105 |
| 8–12 | Dequeue × 5 | 0 | 1→0→empty | queue drains in FIFO order |
| 13 | Dequeue on empty | — | — | **Underflow error** |



## Queue Logic Summary

```
rear  = (rear  + 1) % capacity   // enqueue pointer advance (wraps 4 → 0)
front = (front + 1) % capacity   // dequeue pointer advance (wraps 4 → 0)
```

All operations are **O(1)** time, **O(n)** total space where n = capacity.
