import { Button, Checkbox, Select, Space, Typography } from "antd";
import { candidateGroup, orderedCandidates } from "./boardValues.js";
import "./candidateBoard.css";
export function CandidateOrigins({ item, items }) {
  if (!item.sourceCandidateIds?.length) return null;
  // Iterative traversal keeps deeply nested combinations bounded by the loaded candidate set.
  const seen = new Set([item.id]),
    pending = [...item.sourceCandidateIds],
    originals = [];
  while (pending.length) {
    const id = pending.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const source = items.find((row) => row.id === id);
    if (!source) {
      originals.push({ id, statement: "Original unavailable" });
      continue;
    }
    originals.push(source);
    pending.push(...(source.sourceCandidateIds ?? []));
  }
  return (
    <details className="candidate-origins">
      <summary>Source candidates ({originals.length})</summary>
      <ul>
        {originals.map((row) => (
          <li key={row.id}>
            <p>{row.statement}</p>
            <Typography.Text type="secondary">
              {row.authorEmail || row.createdBy}
              {row.createdAt?.toDate
                ? ` · ${row.createdAt.toDate().toLocaleString()}`
                : ""}
            </Typography.Text>
          </li>
        ))}
      </ul>
    </details>
  );
}
export default function CandidateBoard({
  items,
  groups,
  selected,
  onSelect,
  onMove,
  disabled,
  renderCandidate,
}) {
  const lanes = [{ id: "ungrouped", name: "Ungrouped" }, ...groups];
  const pending = items.filter((row) => row.status === "pending");
  // Preserve visibility if a malformed or unavailable group reference is encountered.
  for (const item of pending)
    if (!lanes.some((g) => g.id === candidateGroup(item)))
      lanes.push({ id: candidateGroup(item), name: "Unavailable group" });
  return (
    <div className="candidate-board" aria-label="Candidate grouping board">
      {lanes.map((group) => {
        const rows = orderedCandidates(
          pending.filter((row) => candidateGroup(row) === group.id),
        );
        return (
          <section
            className="candidate-lane"
            key={group.id}
            aria-label={`Group: ${group.name}`}
            onDragOver={(event) => {
              if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("application/x-candidate");
              if (!disabled && pending.some((row) => row.id === id))
                onMove(id, group.id);
            }}
          >
            <Typography.Title level={4}>
              {group.name} <span>({rows.length})</span>
            </Typography.Title>
            {!rows.length && (
              <p className="candidate-empty">Drop candidates here</p>
            )}
            {rows.map((item, index) => (
              <article
                key={item.id}
                className={`candidate-card${selected.includes(item.id) ? " selected" : ""}`}
                draggable={!disabled}
                onDragStart={(event) =>
                  event.dataTransfer.setData("application/x-candidate", item.id)
                }
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const id = event.dataTransfer.getData(
                    "application/x-candidate",
                  );
                  if (
                    !disabled &&
                    id !== item.id &&
                    pending.some((row) => row.id === id)
                  )
                    onMove(id, group.id, item.id);
                }}
              >
                <Checkbox
                  aria-label={`Select candidate: ${item.statement}`}
                  disabled={
                    disabled ||
                    (selected.length >= 8 && !selected.includes(item.id))
                  }
                  checked={selected.includes(item.id)}
                  onChange={(event) => onSelect(item.id, event.target.checked)}
                >
                  Select
                </Checkbox>
                {renderCandidate(item, true)}
                <Space wrap className="candidate-movement">
                  <Select
                    id={`candidate-move-${item.id}`}
                    aria-label={`Move candidate: ${item.statement}`}
                    value=""
                    disabled={disabled}
                    options={[
                      { value: "", label: "Move to…" },
                      ...lanes.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                    onChange={(id) => {
                      if (id) onMove(item.id, id);
                    }}
                  />
                  <Button
                    size="small"
                    aria-label={`Move up: ${item.statement}`}
                    disabled={disabled || index === 0}
                    onClick={() =>
                      onMove(item.id, group.id, rows[index - 1].id)
                    }
                  >
                    Up
                  </Button>
                  <Button
                    size="small"
                    aria-label={`Move down: ${item.statement}`}
                    disabled={disabled || index === rows.length - 1}
                    onClick={() =>
                      onMove(item.id, group.id, rows[index + 2]?.id)
                    }
                  >
                    Down
                  </Button>
                </Space>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
